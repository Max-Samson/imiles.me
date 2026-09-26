import { LayoutDashboard, type LucideIcon, UsersRound } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
}

export const adminNavigation: AdminNavItem[] = [
  { label: '概览', href: '/admin', icon: LayoutDashboard, enabled: true },
  { label: '友链', href: '/admin/friend-links', icon: UsersRound, enabled: false },
];
