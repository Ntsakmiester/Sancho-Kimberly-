import { forgotHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = forgotHandler(['admin', 'staff'], { back: '/admin/forgot-password', resetPath: '/admin/reset-password' });
