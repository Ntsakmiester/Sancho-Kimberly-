import AuthForm, { AuthLink } from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrator login | Sancho Kimberly' };
export default function AdminLogin({ searchParams }) {
  return (
    <AuthForm title="Administrator login" action="/api/admin/login" button="Log in"
      error={searchParams.error} notice={searchParams.reset ? 'Password updated. Please log in with your new password.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Email address', autoComplete: 'email' }, { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'current-password' }]}>
      <AuthLink href="/admin/forgot-password">Forgot Password?</AuthLink>
    </AuthForm>
  );
}
