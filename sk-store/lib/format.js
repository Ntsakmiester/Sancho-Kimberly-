export const price = (c) => 'R ' + Math.round(c / 100).toLocaleString('en-ZA');
export const rands = (c) => ((c || 0) / 100).toFixed(2);
// Exact amount (cents shown) for finance and money tables.
export const money = (c) => 'R ' + ((c || 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
