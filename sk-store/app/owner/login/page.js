import AuthForm, { AuthLink } from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner login | Sancho Kimberly' };
export default async function OwnerLogin({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Owner Control Panel" sub="Authorised owner access only." action="/api/owner/login" button="Log in"
      error={searchParams.error} notice={searchParams.reset ? 'Password updated. Please log in with your new password.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Owner email', autoComplete: 'email' }, { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'current-password' }, { name: 'code', type: 'text', placeholder: 'Authenticator or recovery code (if enabled)', autoComplete: 'one-time-code', required: false }]}>
      <AuthLink href="/owner/forgot-password">Forgot Password?</AuthLink>
    </AuthForm>
  );
}
