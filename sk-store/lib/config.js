// Delivery settings (placeholders until the owner confirms real rates).
export const SHIPPING_CENTS = 9900;
export const FREE_SHIPPING_OVER_CENTS = 100000;
export const shippingFor = (subtotalCents) => (subtotalCents >= FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS);
export const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'];
