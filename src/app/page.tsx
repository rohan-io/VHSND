import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Page() {
  const session = (await cookies()).get('admin_session');
  redirect(session ? '/dashboard/due-list' : '/login');
}
