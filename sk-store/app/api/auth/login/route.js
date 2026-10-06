import { loginHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = loginHandler('customer', { back: '/login', next: '/shop' });
