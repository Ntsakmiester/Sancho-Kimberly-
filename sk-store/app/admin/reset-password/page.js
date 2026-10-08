import AuthForm from '../../../components/AuthForm';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'New admin password | Sancho Kimberly' };
export default async function AdminReset({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  return (
    <AuthForm title="Choose a new password" action="/api/admin/reset-password" button="Update password" error={searchParams.error}
      fields={[{ name: 'token', type: 'hidden', value: searchParams.token || '' }, { name: 'password', type: 'password', placeholder: 'New password (8+ characters)', autoComplete: 'new-password' }]} />
  );
}
