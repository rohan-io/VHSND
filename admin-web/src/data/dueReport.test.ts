import { describe, it, expect } from 'vitest';
import { daysUntil, dueBucket } from './dueReport';

const TODAY = new Date(2026, 8, 17); // 2026-09-17

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil('2026-09-17', TODAY)).toBe(0);
  });
  it('returns a positive count for future dates', () => {
    expect(daysUntil('2026-09-20', TODAY)).toBe(3);
  });
  it('returns a negative count for past dates', () => {
    expect(daysUntil('2026-09-10', TODAY)).toBe(-7);
  });
});

describe('dueBucket', () => {
  it('buckets past dates as Overdue', () => {
    expect(dueBucket('2026-09-10', TODAY)).toBe('Overdue');
  });
  it('buckets today as Due Today', () => {
    expect(dueBucket('2026-09-17', TODAY)).toBe('Due Today');
  });
  it('buckets within the next 7 days as Due This Week', () => {
    expect(dueBucket('2026-09-24', TODAY)).toBe('Due This Week');
  });
  it('buckets day 8+ as Upcoming', () => {
    expect(dueBucket('2026-09-25', TODAY)).toBe('Upcoming');
  });
});
