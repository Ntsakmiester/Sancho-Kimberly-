import { PROVINCES } from './config';
// Server-side pricing. The browser only sends slug/size/colour/qty and a coupon code; every amount is computed here.
export class UserError extends Error { userFacing = true; }
const MAX_QTY = 10;
export const unitPrice = (p, v) => (v.price_cents != null ? v.price_cents : p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents);

export async function shippingFor(db, province, subtotalAfterDiscount) {
  const r = (await db.query("select * from shipping_rates where active and $1=any(provinces) order by fee_cents asc, id limit 1", [province])).rows[0];
  if (!r) return null;
  const free = r.free_over_cents != null && subtotalAfterDiscount >= r.free_over_cents;
  return { id: r.id, method: r.method, courier: r.courier, fee: free ? 0 : r.fee_cents, zone: r.zone, estMin: r.est_days_min, estMax: r.est_days_max };
}

export async function validateCoupon(db, code, { lines, subtotal, userId, email }) {
  const c = (await db.query('select * from coupons where upper(code)=upper($1)', [String(code).trim()])).rows[0];
  const bad = (m) => { throw new UserError(m); };
  if (!c || !c.active) bad('That coupon code is not valid.');
  const now = new Date();
  if (c.starts_at && new Date(c.starts_at) > now) bad('That coupon is not active yet.');
  if (c.ends_at && new Date(c.ends_at) < now) bad('That coupon has expired.');
  if (subtotal < c.min_order_cents) bad(`This coupon needs a minimum order of R ${(c.min_order_cents / 100).toFixed(0)}.`);
  // Only orders with a verified payment (or still awaiting one) count against the limits; abandoned unpaid orders older than 2h are ignored.
  const counted = "(o.payment_status='PAID' or o.created_at > now() - interval '2 hours') and o.status<>'CANCELLED'";
  if (c.max_uses != null) {
    const n = (await db.query(`select count(*)::int c from coupon_redemptions r join orders o on o.id=r.order_id where r.coupon_id=$1 and ${counted}`, [c.id])).rows[0].c;
    if (n >= c.max_uses) bad('That coupon has reached its usage limit.');
  }
  if (c.max_uses_per_customer != null && (userId || email)) {
    const n = (await db.query(`select count(*)::int c from coupon_redemptions r join orders o on o.id=r.order_id where r.coupon_id=$1 and (r.user_id=$2 or lower(r.email)=lower($3)) and ${counted}`, [c.id, userId || 0, email || ''])).rows[0].c;
    if (n >= c.max_uses_per_customer) bad('You have already used this coupon.');
  }
  if (c.first_order_only) {
    const n = (await db.query("select count(*)::int c from orders where (user_id=$1 or lower(email)=lower($2)) and payment_status='PAID'", [userId || 0, email || ''])).rows[0].c;
    if (n > 0) bad('This coupon is for first orders only.');
  }
  let eligible = lines;
  if (c.product_ids?.length) eligible = eligible.filter((l) => c.product_ids.includes(l.productId));
  if (c.category_ids?.length) eligible = eligible.filter((l) => c.category_ids.includes(l.categoryId));
  const base = eligible.reduce((s, l) => s + l.unit * l.qty, 0);
  if (!base) bad('This coupon does not apply to the items in your cart.');
  const amount = c.kind === 'PERCENT' ? Math.floor((base * Math.min(c.value, 100)) / 100) : Math.min(c.value, base);
  return { coupon: c, amount };
}

// items: [{slug,size,colour?,qty}]. Returns everything needed to create an order. Does NOT touch stock.
export async function quote(db, { items, province, couponCode, userId, email, forUpdate = false }) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new UserError('Your cart is empty.');
  if (!PROVINCES.includes(province)) throw new UserError('Please choose a province.');
  const lines = [];
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= MAX_QTY)) throw new UserError('Invalid quantity.');
    const r = await db.query(
      `select p.id pid,p.name,p.price_cents,p.sale_price_cents,p.category_id,v.id vid,v.size,v.colour,v.sku,v.price_cents vprice,v.qty,v.active vactive
       from products p join variants v on v.product_id=p.id where p.slug=$1 and p.active and p.archived_at is null and v.size=$2 and v.colour=$3 ${forUpdate ? '' : ''}`,
      [String(it.slug), String(it.size), String(it.colour || '')]);
    const v = r.rows[0];
    if (!v || !v.vactive) throw new UserError('A product in your cart is no longer available.');
    if (v.qty < qty) throw new UserError(`${v.name} (${v.size}) is sold out or doesn't have enough stock.`);
    const unit = unitPrice({ price_cents: v.price_cents, sale_price_cents: v.sale_price_cents }, { price_cents: v.vprice });
    const dup = lines.find((l) => l.variantId === v.vid);
    if (dup) { dup.qty += qty; if (dup.qty > MAX_QTY) throw new UserError('Invalid quantity.'); if (v.qty < dup.qty) throw new UserError(`${v.name} (${v.size}) doesn't have enough stock.`); continue; }
    lines.push({ productId: v.pid, categoryId: v.category_id, variantId: v.vid, name: v.name, size: v.size, colour: v.colour, sku: v.sku, qty, unit });
  }
  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    const c = await validateCoupon(db, couponCode, { lines, subtotal, userId, email });
    discount = c.amount; coupon = c.coupon;
  }
  const ship = await shippingFor(db, province, subtotal - discount);
  if (!ship) throw new UserError('We do not deliver to that province yet.');
  const total = subtotal - discount + ship.fee;
  const st = Object.fromEntries((await db.query("select key,value from settings where key in ('vat_registered','vat_rate','prices_include_vat')")).rows.map((x) => [x.key, x.value]));
  const rate = parseFloat(st.vat_rate || '15');
  const vat = st.vat_registered === 'true' ? (st.prices_include_vat === 'false' ? 0 : Math.round((total * rate) / (100 + rate))) : 0;
  return { lines, subtotal, discount, coupon, shipping: ship, shippingCents: ship.fee, total, vat };
}
