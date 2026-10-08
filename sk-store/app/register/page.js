import AuthForm, { AuthLink } from '../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create account | Sancho Kimberly' };
export default async function Register({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Create your account" action="/api/auth/register" button="Create account" error={searchParams.error}
      fields={[{ name: 'name', placeholder: 'Full name', autoComplete: 'name' }, { name: 'email', type: 'email', placeholder: 'Email address', autoComplete: 'email' }, { name: 'password', type: 'password', placeholder: 'Password (8+ characters)', autoComplete: 'new-password' }]}>
      <AuthLink href="/login">Already have an account? Log in</AuthLink>
    </AuthForm>
  );
}
