// Read-only store tools for the assistant. Everything the AI can say about the store comes
// from these functions - the database stays the source of truth. No tool here can write to
// products, inventory, orders or payments, and customer data is scoped to the signed-in user.
import pool from '../db';
import { listProducts, getProduct, filterOptions, categoryNames, effective } from '../products';
import { getSettings } from '../service';
import { contactLinks } from '../contact';

const money = (c) => 'R ' + (c / 100).toFixed(2).replace(/\.00$/, '');

function cardOf(p) {
  const variants = (p.variants || []).map((v) => ({ size: v.size, colour: v.colour, qty: v.qty, price_cents: v.price_cents, image_url: v.image_url }));
  const inStock = variants.filter((v) => v.qty > 0);
  const one = inStock.length === 1 ? inStock[0] : null;
  return {
    slug: p.slug, name: p.name, category: p.category,
    price_cents: p.price_cents, sale_price_cents: p.sale_price_cents, effective_cents: effective(p),
    image: p.images?.[0]?.url || null, rating: p.rating, review_count: p.review_count,
    in_stock: inStock.length > 0,
    sizes: variants.map((v) => ({ size: v.size, colour: v.colour || null, in_stock: v.qty > 0 })),
    url: '/product/' + p.slug,
    add_to_cart: one ? { slug: p.slug, name: p.name, size: one.size, colour: one.colour || '', price_cents: one.price_cents ?? effective(p), image: one.image_url || p.images?.[0]?.url || null } : null,
  };
}

// Pull shopping filters out of natural language ("black tee under R800 in size L").
export async function parseShoppingQuery(text) {
  const t = String(text).toLowerCase();
  const out = { q: '', size: '', colour: '', max: null, min: null, sale: false, category: null };
  const under = t.match(/(?:under|below|less than|cheaper than|max(?:imum)?)\s*r?\s*([\d\s,.]+)/);
  if (under) out.max = Math.round(parseFloat(under[1].replace(/[\s,]/g, '')) * 100);
  const over = t.match(/(?:over|more than|at least)\s*r?\s*([\d\s,.]+)/);
  if (over) out.min = Math.round(parseFloat(over[1].replace(/[\s,]/g, '')) * 100);
  const bare = !out.max && !out.min ? t.match(/r\s*([\d\s,.]+)/) : null;
  if (bare) out.max = Math.round(parseFloat(bare[1].replace(/[\s,]/g, '')) * 100);
  if (/(on sale|special|discount)/.test(t)) out.sale = true;
  try {
    const opts = await filterOptions();
    const sizeHit = opts.sizes.find((s) => new RegExp(`(^|[^a-z0-9])${s.toLowerCase()}([^a-z0-9]|$)`).test(t) && (t.includes('size') || s.length === 1 || /x/i.test(s)));
    if (sizeHit) out.size = sizeHit;
    out.colour = opts.colours.find((c) => t.includes(c.toLowerCase())) || '';
  } catch {}
  try {
    const cats = await categoryNames();
    out.category = cats.find((c) => t.includes(c.toLowerCase())) || null;
  } catch {}
  let q = t
    .replace(/(show me|looking for|do you( guys)? have|find me|find something|any|i need|i want|please|can i get|is this|still|something|anything)/g, ' ')
    .replace(/under\s*r?\s*[\d\s,.]+|over\s*r?\s*[\d\s,.]+|r\s*[\d\s,.]+/g, ' ')
    .replace(/(affordable|cheap(?:est)?|on sale|special|size\s*\w+|in stock|available)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (out.colour) q = q.replace(out.colour.toLowerCase(), ' ').replace(/\s+/g, ' ').trim();
  out.q = q.slice(0, 60);
  if (/cheapest|lowest price/.test(t)) out.sort = 'price_asc';
  return out;
}

export async function searchProducts(text, limit = 6) {
  const f = await parseShoppingQuery(text);
  const rows = await listProducts(f.category, { q: f.q, size: f.size, colour: f.colour, max: f.max, min: f.min, sale: f.sale, inStock: true, sort: f.sort || '', limit, offset: 0 });
  let cards = rows.map(cardOf);
  if (!cards.length && (f.q || f.size || f.colour || f.max)) {
    const relaxed = await listProducts(f.category, { q: f.q ? '' : '', sale: f.sale, inStock: true, sort: f.sort || '', limit, offset: 0 });
    cards = relaxed.map(cardOf);
    return { cards, filters: f, relaxed: true };
  }
  return { cards, filters: f, relaxed: false };
}

export async function productDetails(slug) {
  const p = await getProduct(String(slug || ''));
  return p ? cardOf(p) : null;
}

export async function compareProducts(slugs) {
  const found = [];
  for (const s of slugs.slice(0, 3)) { const c = await productDetails(s); if (c) found.push(c); }
  return found;
}

export async function recommendProducts({ excludeSlug = '', maxPrice = null, category = null, limit = 4 } = {}) {
  const rows = await listProducts(category, { max: maxPrice, inStock: true, limit: limit + 1, offset: 0 });
  return rows.filter((p) => p.slug !== excludeSlug).slice(0, limit).map(cardOf);
}

export async function checkAvailability(slug, size = '', colour = '') {
  const p = await getProduct(String(slug || ''));
  if (!p) return null;
  const variants = (p.variants || []).filter((v) => (!size || v.size.toLowerCase() === String(size).toLowerCase()) && (!colour || (v.colour || '').toLowerCase() === String(colour).toLowerCase()));
  return { card: cardOf(p), matching: variants.map((v) => ({ size: v.size, colour: v.colour, in_stock: v.qty > 0 })) };
}

export async function shippingInfo() {
  const r = await pool.query('select zone,method,courier,fee_cents,free_over_cents,est_days_min,est_days_max,provinces from shipping_rates where active order by fee_cents asc, id');
  return r.rows.map((x) => ({ zone: x.zone, method: x.method, courier: x.courier || null, fee: money(x.fee_cents), fee_cents: x.fee_cents, free_over: x.free_over_cents != null ? money(x.free_over_cents) : null, est_days: `${x.est_days_min} to ${x.est_days_max} working days`, provinces: x.provinces }));
}

const ORDER_COLS = 'ref,status,payment_status,total_cents,created_at,tracking_number,courier,est_delivery,shipping_method';
export async function ownOrders(userId, ref = '') {
  if (!userId) return { authRequired: true, orders: [] };
  const args = [userId];
  let where = 'o.user_id=$1';
  if (ref) { args.push('%' + ref.replace(/[%_]/g, '') + '%'); where += ' and o.ref ilike $2'; }
  const r = await pool.query(
    `select ${ORDER_COLS} from orders o where ${where} order by o.created_at desc limit 5`, args);
  const orders = [];
  for (const o of r.rows) {
    const items = (await pool.query(
      `select oi.qty, oi.size, oi.colour, oi.price_cents, p.name from order_items oi left join products p on p.id=oi.product_id where oi.order_id=(select id from orders where ref=$1)`, [o.ref])).rows;
    orders.push({
      ref: o.ref, status: o.status, payment_status: o.payment_status,
      total: money(o.total_cents), placed: o.created_at,
      items: items.map((i) => `${i.qty} x ${i.name || 'Item'}${i.size ? ' (' + i.size + ')' : ''}`),
      tracking_number: o.tracking_number || null, courier: o.courier || null,
      est_delivery: o.est_delivery || null, shipping_method: o.shipping_method || null,
      url: '/account/orders/' + o.ref,
    });
  }
  return { authRequired: false, orders };
}

export async function knowledgeSearch(text, limit = 3) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 8);
  const r = await pool.query('select id,title,category,content,updated_at from ai_knowledge where active order by position, id limit 50');
  const scored = r.rows.map((k) => {
    const hay = (k.title + ' ' + k.category + ' ' + k.content).toLowerCase();
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    return { ...k, score };
  }).filter((k) => k.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map(({ title, category, content, updated_at }) => ({ title, category, content, updated_at }));
}

export async function storeInfo() {
  const s = await getSettings().catch(() => ({}));
  return { contacts: contactLinks(s), tiktok: '@sancho.kimberlyco' };
}

export function summarizeCards(cards) {
  return cards.map((c) => ({
    name: c.name, price: money(c.effective_cents), was: c.sale_price_cents != null && c.sale_price_cents < c.price_cents ? money(c.price_cents) : null,
    in_stock: c.in_stock, sizes_available: c.sizes.filter((s) => s.in_stock).map((s) => s.size + (s.colour ? '/' + s.colour : '')),
    url: c.url,
  }));
}
export { money };
