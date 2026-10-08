// Fixed-answer mode: the assistant's zero-cost brain. Used when no AI provider is configured
// and as the graceful fallback when the provider is down. Answers are deterministic and every
// store fact comes from the read-only tools - nothing is invented.
import { searchProducts, ownOrders, shippingInfo, knowledgeSearch, storeInfo, money, checkAvailability } from './tools';

const SIZES_TEXT = 'Tees come in S, M, L and XL. Beanies are one size.';
export async function fallbackAnswer({ intent, text, user, cfg }) {
  const info = await storeInfo().catch(() => ({ contacts: [], tiktok: '@sancho.kimberlyco' }));
  const contactBlock = info.contacts.length
    ? { links: info.contacts }
    : { links: [{ label: 'TikTok', text: '@sancho.kimberlyco', href: 'https://www.tiktok.com/@sancho.kimberlyco' }] };

  if (['PRODUCT_SEARCH', 'PRODUCT_INFORMATION', 'PRODUCT_RECOMMENDATION', 'PRODUCT_COMPARISON'].includes(intent)) {
    try {
      const { cards, relaxed } = await searchProducts(text, 6);
      if (cards.length) {
        // Cards carry the pictures, prices and stock - the text stays short and points at them.
        const intro = relaxed
          ? `I couldn't find an exact match, but these are close. Tap a product to see it, or tell me a colour, size or budget to narrow it down.`
          : cards.length === 1
            ? `Here you go - tap it to see details, or tell me a size and I'll check stock.`
            : `Here's what I found. Tap a product to see it, or tell me a colour, size or budget to narrow it down.`;
        return { text: intro, products: cards };
      }
      return { text: `I couldn't find anything matching that right now. Try a different word, or tell me a category, colour, size or budget and I'll look again.` };
    } catch {
      return { text: `I'm not able to check the catalogue right now. The shop page has everything that's available.` };
    }
  }
  if (intent === 'CART_HELP') {
    return { text: `Your cart lives at the top right of the store. You can change quantities or remove items there before checkout. If you'd like, tell me what you're looking for and I'll help you find it.` };
  }
  if (intent === 'ORDER_TRACKING') {
    if (!user) return { text: `To check your own orders, sign in first (person icon, top right), then ask me again. Right after checkout you also get an order page link with live status.` };
    try {
      const { orders } = await ownOrders(user.id);
      if (!orders.length) return { text: `I couldn't find any orders on your account yet. If you checked out as a guest, your order page link is the fastest way to track it.` };
      const o = orders[0];
      const extra = o.tracking_number ? ` Tracking: ${o.tracking_number}${o.courier ? ' via ' + o.courier : ''}.` : '';
      return { text: `Your latest order ${o.ref} is ${o.status} (payment ${o.payment_status}), placed ${new Date(o.placed).toLocaleDateString('en-ZA')}, total ${o.total}.${extra} You have ${orders.length} order${orders.length > 1 ? 's' : ''} on your account - they're all under Account, then Orders.`, orders };
    } catch { return { text: `I'm not able to check orders right now. Your orders are listed under Account, then Orders.` }; }
  }
  if (intent === 'SHIPPING') {
    try {
      const rates = await shippingInfo();
      if (rates.length) {
        const r = rates[0];
        return { text: `${r.method} is ${r.fee} anywhere in South Africa${r.free_over ? `, free on orders over ${r.free_over}` : ''}. It takes about ${r.est_days}. The exact fee shows at checkout before you pay.` };
      }
    } catch {}
    return { text: `We deliver anywhere in South Africa. The exact fee and timing show at checkout before you pay.` };
  }
  if (intent === 'RETURNS' || intent === 'REFUNDS') {
    const k = await knowledgeSearch('returns refunds exchanges', 1).catch(() => []);
    return { text: (k[0]?.content || 'Changed your mind? Returns are free within 7 days of delivery.') + (intent === 'REFUNDS' ? ' Refunds are handled by our team - I can escalate this for you if something went wrong.' : ''), ...contactBlock };
  }
  if (intent === 'PAYMENT_HELP' || intent === 'CHECKOUT_HELP') {
    return { text: `You pay online at checkout - the available payment options show on the payment step, and nothing is charged before you confirm. I'll never ask for card numbers, CVVs or OTPs. If a payment failed, no order is lost: your cart stays put and you can try again. If it keeps failing, say "talk to support" and I'll get a person to help.` };
  }
  if (intent === 'ACCOUNT_HELP') {
    return { text: `Tap the person icon at the top right to sign in or create an account. Forgot your password? There's a reset link on the sign-in page.` };
  }
  if (intent === 'STORE_INFORMATION') {
    return { text: `Here's how to reach the store:`, ...contactBlock };
  }
  const k = await knowledgeSearch(text, 2).catch(() => []);
  if (k.length) return { text: k[0].content, sources: k.map((x) => x.title) };
  if (/^\s*(hi|hello|hey|sawubona|dumela|molo|good (morning|afternoon|evening))\b/i.test(text)) {
    const name = user?.name?.split(' ')[0];
    return { text: `Hi${name ? ' ' + name : ''}! I can help you find products, track orders and answer questions about the store. What do you need?` };
  }
  return { text: `I'm not able to confirm that from the information available to me. I can help you find products, check your orders, explain delivery or returns, or get a human to help - just say the word.` };
}
