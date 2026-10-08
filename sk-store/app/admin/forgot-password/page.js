import AuthForm, { AuthLink } from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin password reset | Sancho Kimberly' };
export default async function AdminForgot({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Reset administrator password" sub="Enter your registered administrator email." action="/api/admin/forgot-password" button="Send reset link"
      error={searchParams.error} notice={searchParams.sent ? 'If an account exists for this email address, you will receive a password reset link.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Email address', autoComplete: 'email' }]}>
      <AuthLink href="/admin/login">Back to admin login</AuthLink>
    </AuthForm>
  );
}
