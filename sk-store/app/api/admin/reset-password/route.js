import { resetHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = resetHandler(['admin', 'staff'], { back: '/admin/reset-password', loginPath: '/admin/login' });
