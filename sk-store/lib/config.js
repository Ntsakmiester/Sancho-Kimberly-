// Delivery fees, free-shipping thresholds and VAT are NOT hard-coded: they live in the shipping_rates and settings tables
// and are managed by the owner/admin. Only the list of provinces is fixed.
export const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'];
// South African mobile/landline numbers: 0XXXXXXXXX or +27XXXXXXXXX (spaces/dashes allowed).
export const normalisePhone = (s) => {
  const d = String(s || '').replace(/[\s\-()]/g, '');
  const m = d.match(/^(?:\+27|0027|27|0)([1-9]\d{8})$/);
  return m ? '+27' + m[1] : null;
};
export const isSaPostal = (s) => /^\d{4}$/.test(String(s || '').trim());
