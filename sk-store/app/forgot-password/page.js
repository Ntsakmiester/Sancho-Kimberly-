import AuthForm, { AuthLink } from '../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forgot password | Sancho Kimberly' };
export default async function Forgot({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Reset your password" sub="Enter the email address on your account." action="/api/auth/forgot-password" button="Send reset link"
      error={searchParams.error} notice={searchParams.sent ? 'If an account exists for this email address, you will receive a password reset link.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Email address', autoComplete: 'email' }]}>
      <AuthLink href="/login">Back to log in</AuthLink>
    </AuthForm>
  );
}
