import AuthForm, { AuthLink } from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner password reset | Sancho Kimberly' };
export default async function OwnerForgot({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Reset owner password" sub="Enter the owner account email address." action="/api/owner/forgot-password" button="Send reset link"
      error={searchParams.error} notice={searchParams.sent ? 'If an account exists for this email address, you will receive a password reset link.' : ''}
      fields={[{ name: 'email', type: 'email', placeholder: 'Owner email', autoComplete: 'email' }]}>
      <AuthLink href="/owner/login">Back to owner login</AuthLink>
    </AuthForm>
  );
}
