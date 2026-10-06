import AuthForm, { AuthLink } from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner login | Sancho Kimberly' };
export default function OwnerLogin({ searchParams }) {
  return (
    <AuthForm title="Owner Control Panel" sub="Authorised owner access only." action="/api/owner/login" button="Log in"
      error={searchParams.error} notice={searchParams.reset ? 'Password updated. Please log in with your new password.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Owner email', autoComplete: 'email' }, { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'current-password' }]}>
      <AuthLink href="/owner/forgot-password">Forgot Password?</AuthLink>
    </AuthForm>
  );
}
