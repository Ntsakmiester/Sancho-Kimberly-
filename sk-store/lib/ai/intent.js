// Intent, category, priority, language and prompt-injection detection. Deterministic and cheap:
// it decides routing before any AI provider call, and it works with no provider at all.
const has = (t, ...words) => words.some((w) => t.includes(w));

const RULES = [
  ['HUMAN_SUPPORT', ['speak to someone', 'talk to someone', 'real person', 'human', 'agent', 'manager', 'person help', 'someone help me', 'can someone help']],
  ['ORDER_TRACKING', ['where is my order', "where's my order", 'wheres my order', 'track my order', 'track my package', "where's my package", 'my package', 'order status', 'my order', 'has my order shipped', 'order number', 'did my order', 'when did i order', 'tracking number']],
  ['PRODUCT_COMPARISON', ['compare', 'versus', ' vs ', 'difference between', 'which is better', 'which one']],
  ['PRODUCT_RECOMMENDATION', ['recommend', 'what should i', 'something for', 'birthday', 'gift', 'suggest', 'similar', 'anything like', 'cheaper ones', 'similar but cheaper', 'what else']],
  ['PRODUCT_SEARCH', ['show me', 'looking for', 'do you have', 'do you guys have', 'any hood', 'hoodie', 'tee', 't-shirt', 'tshirt', 'shirt', 'beanie', 'cap', 'jacket', 'sneaker', 'under r', 'cheapest', 'on sale', 'affordable', 'find me', 'find something', 'in stock', 'available', 'black', 'white', 'size ']],
  ['CART_HELP', ['my cart', 'the cart', 'add to cart', 'remove from cart', 'change quantity', 'in my basket', 'basket']],
  ['PAYMENT_HELP', ['payment failed', 'payfast', 'why did my payment', 'payment declined', 'card declined', 'payment method', 'how do i pay', 'how do you pay', 'eft', 'pay with', 'checkout won', "can't pay", 'cant pay', 'charged']],
  ['CHECKOUT_HELP', ['checkout', 'complete my order', 'place my order', 'finish my order']],
  ['RETURNS', ['return', 'exchange', 'send back', 'wrong size', 'wrong item', "doesn't fit", 'doesnt fit', 'swap']],
  ['REFUNDS', ['refund', 'money back', 'my money']],
  ['SHIPPING', ['delivery', 'deliver', 'shipping', 'ship', 'how long', 'courier', 'arrive', 'postnet', 'pep', 'pargo']],
  ['ACCOUNT_HELP', ['sign in', 'login', 'log in', 'password', 'account', 'register', 'profile', 'my details']],
  ['STORE_INFORMATION', ['contact', 'hours', 'open', 'located', 'where are you', 'about the store', 'who are you', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'email']],
];
export const INTENTS = ['PRODUCT_SEARCH', 'PRODUCT_INFORMATION', 'PRODUCT_COMPARISON', 'PRODUCT_RECOMMENDATION', 'CART_HELP', 'CHECKOUT_HELP', 'PAYMENT_HELP', 'ORDER_TRACKING', 'SHIPPING', 'RETURNS', 'REFUNDS', 'ACCOUNT_HELP', 'STORE_INFORMATION', 'FAQ', 'HUMAN_SUPPORT', 'OTHER'];
export function detectIntent(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  for (const [intent, words] of RULES) if (has(t, ...words)) return intent;
  if (has(t, 'price', 'how much', 'cost')) return 'PRODUCT_INFORMATION';
  return 'OTHER';
}
export const INTENT_CATEGORY = {
  PRODUCT_SEARCH: 'PRODUCT', PRODUCT_INFORMATION: 'PRODUCT', PRODUCT_COMPARISON: 'PRODUCT', PRODUCT_RECOMMENDATION: 'PRODUCT',
  ORDER_TRACKING: 'ORDER', PAYMENT_HELP: 'PAYMENT', CHECKOUT_HELP: 'PAYMENT', SHIPPING: 'SHIPPING',
  RETURNS: 'RETURN', REFUNDS: 'REFUND', ACCOUNT_HELP: 'ACCOUNT', CART_HELP: 'GENERAL',
  STORE_INFORMATION: 'GENERAL', FAQ: 'GENERAL', HUMAN_SUPPORT: 'GENERAL', OTHER: 'GENERAL',
};
const INTENT_BOT = {
  PRODUCT_SEARCH: 'shopping', PRODUCT_INFORMATION: 'shopping', PRODUCT_COMPARISON: 'shopping', PRODUCT_RECOMMENDATION: 'shopping', CART_HELP: 'shopping',
  ORDER_TRACKING: 'orders', SHIPPING: 'delivery', PAYMENT_HELP: 'payments', CHECKOUT_HELP: 'payments',
};
export const botForIntent = (i) => INTENT_BOT[i] || 'support';

const INJECTION = [
  /ignore (all |any )?(your )?(previous|prior|earlier) (instructions|rules|prompts)/i,
  /(show|reveal|tell|give|print).{0,40}(system prompt|your instructions|your prompt|api key|password|credentials|secret|database)/i,
  /(database|db) (password|credentials|connection string)/i,
  /disable (your )?(security|filters|guardrails|rules)/i,
  /(other|another) customer'?s? (orders|account|details)/i,
  /\bjailbreak\b/i, /\bbypass\b.{0,30}(security|filter|rule)/i,
  /act as (if )?(you (are|were)|an? )?(admin|owner|root)/i,
  /you are now (a|an|the) /i,
];
export const isInjection = (text) => INJECTION.some((r) => r.test(text));

const URGENT = ['dispute', 'charged twice', 'fraud', 'scam', 'hacked', 'unauthorized', 'unauthorised', 'someone used my', 'not my order'];
const HIGH = ['never arrived', 'not delivered', 'missing', 'damaged', 'broken', 'wrong item', 'wrong size sent', "didn't arrive", 'didnt arrive', 'no delivery'];
export function detectPriority(text, intent) {
  const t = String(text).toLowerCase();
  if (has(t, ...URGENT)) return 'URGENT';
  if (has(t, ...HIGH)) return 'HIGH';
  if (intent === 'REFUNDS' || intent === 'RETURNS' || intent === 'PAYMENT_HELP') return 'MEDIUM';
  if (intent === 'HUMAN_SUPPORT') return 'MEDIUM';
  return 'LOW';
}
export function wantsHuman(text, intent) {
  const t = String(text).toLowerCase();
  if (intent === 'HUMAN_SUPPORT') return true;
  return has(t, ...URGENT, ...HIGH);
}
const LANG_MARKERS = {
  zu: ['sawubona', 'ngiyabonga', 'unjani', 'yebo', 'ngicela'],
  st: ['dumela', 'kea leboha', 'otswa'],
  af: ['asseblief', 'dankie', 'goeie more', 'hoe lank', 'hoeveel'],
  ts: ['avuxeni', 'ndza khensa'],
  nso: ['ke a leboga', 'thobela'],
  tn: ['dumelang', 'ke itumetse'],
};
export function detectLanguage(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  for (const [lang, words] of Object.entries(LANG_MARKERS)) if (words.some((w) => t.includes(' ' + w))) return lang;
  return 'en';
}
export const LANG_NAMES = { zu: 'isiZulu', st: 'Sesotho', nso: 'Sepedi', ts: 'Xitsonga', tn: 'Setswana', af: 'Afrikaans', en: 'South African English' };
