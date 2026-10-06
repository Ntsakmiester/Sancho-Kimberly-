import { resetHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = resetHandler('customer', { back: '/reset-password', loginPath: '/login' });
