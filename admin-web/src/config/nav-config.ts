import { NavGroup } from '@/types';

/**
 * Navigation for the VHSND Supervisor dashboard's 6 sections. Single mock
 * persona, no RBAC — every item is always visible (see app-sidebar.tsx,
 * which renders these groups directly instead of filtering through Clerk).
 */
export const navGroups: NavGroup[] = [
  {
    label: 'VHSND',
    items: [
      {
        title: 'Due List',
        url: '/dashboard/due-list',
        icon: 'checks',
        isActive: false,
        shortcut: ['d', 'l'],
        items: []
      },
      {
        title: 'ANM Attendance',
        url: '/dashboard/attendance',
        icon: 'teams',
        isActive: false,
        shortcut: ['a', 't'],
        items: []
      },
      {
        title: 'Miss Report',
        url: '/dashboard/miss-report',
        icon: 'alertCircle',
        isActive: false,
        shortcut: ['m', 'r'],
        items: []
      },
      {
        title: 'Due Report',
        url: '/dashboard/due-report',
        icon: 'clock',
        isActive: false,
        shortcut: ['d', 'r'],
        items: []
      },
      {
        title: 'High-Risk Pregnancies',
        url: '/dashboard/high-risk',
        icon: 'warning',
        isActive: false,
        shortcut: ['h', 'r'],
        items: []
      },
      {
        title: 'Referrals',
        url: '/dashboard/referral',
        icon: 'send',
        isActive: false,
        shortcut: ['r', 'f'],
        items: []
      }
    ]
  }
];
