import { resetHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = resetHandler('owner', { back: '/owner/reset-password', loginPath: '/owner/login' });
