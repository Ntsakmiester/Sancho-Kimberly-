import { logoutHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = logoutHandler(null, { back: '/' });
