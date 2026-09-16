import { redirect } from 'next/navigation';

export default function Dashboard() {
  redirect('/dashboard/due-list');
}
