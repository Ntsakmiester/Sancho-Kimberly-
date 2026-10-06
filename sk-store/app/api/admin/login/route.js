import { loginHandler } from '../../../../lib/authflow';
export const dynamic = 'force-dynamic';
export const POST = loginHandler(['admin', 'staff'], { back: '/admin/login', next: '/admin/dashboard' });
