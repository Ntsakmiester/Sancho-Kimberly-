import AuthForm from '../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'New password | Sancho Kimberly' };
export default async function Reset({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Choose a new password" action="/api/auth/reset-password" button="Update password" error={searchParams.error}
      fields={[{ name: 'token', type: 'hidden', value: searchParams.token || '' }, { name: 'password', type: 'password', placeholder: 'New password (8+ characters)', autoComplete: 'new-password' }]} />
  );
}
