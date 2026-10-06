import { forgotHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = forgotHandler('customer', { back: '/forgot-password', resetPath: '/reset-password' });
