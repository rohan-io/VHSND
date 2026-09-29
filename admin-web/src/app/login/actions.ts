'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function continueAsAdmin() {
  const store = await cookies();
  store.set('admin_session', 'USR-ADMIN-001', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
  redirect('/dashboard/due-list');
}

export async function logout() {
  const store = await cookies();
  store.delete('admin_session');
  redirect('/login');
}
