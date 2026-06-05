import React from 'react';
import { LucideIcon } from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  badgeVariant?: 'primary' | 'warning' | 'danger';
}

export function NavItem({ icon: Icon, label, active, onClick, badge, badgeVariant = 'primary' }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
        active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge && (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
          badgeVariant === 'danger' ? 'bg-destructive text-destructive-foreground' :
          badgeVariant === 'warning' ? 'bg-warning text-warning-foreground' :
          'bg-primary/20 text-primary'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
