export type DueBucket = 'Overdue' | 'Due Today' | 'Due This Week' | 'Upcoming';

export function daysUntil(dateISO: string, today: Date): number {
  const target = new Date(`${dateISO}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function dueBucket(dateISO: string, today: Date): DueBucket {
  const d = daysUntil(dateISO, today);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Due Today';
  if (d <= 7) return 'Due This Week';
  return 'Upcoming';
}
