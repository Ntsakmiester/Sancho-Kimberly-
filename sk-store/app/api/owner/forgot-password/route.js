import { forgotHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = forgotHandler('owner', { back: '/owner/forgot-password', resetPath: '/owner/reset-password' });
