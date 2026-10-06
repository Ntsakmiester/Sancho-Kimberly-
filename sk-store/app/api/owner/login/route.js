import { loginHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = loginHandler('owner', { back: '/owner/login', next: '/owner/dashboard' });
