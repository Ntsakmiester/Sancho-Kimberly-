import AuthForm, { AuthLink } from '../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log in | Sancho Kimberly' };
export default async function Login({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Log in" action="/api/auth/login" button="Log in"
      error={searchParams.error} notice={searchParams.registered ? 'Account created - you can log in now.' : searchParams.reset ? 'Password updated. Please log in with your new password.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Email address', autoComplete: 'email' }, { name: 'password', type: 'password', placeholder: 'Password', autoComplete: 'current-password' }]}>
      <AuthLink href="/forgot-password">Forgot Password?</AuthLink>
      <AuthLink href="/register">New here? Create an account</AuthLink>
    </AuthForm>
  );
}
