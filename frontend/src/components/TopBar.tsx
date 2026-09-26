'use client';

import { RefreshCw, Bell } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
}

export default function TopBar({ title, subtitle, onRefresh, refreshing, actions }: TopBarProps) {
  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>{subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        {onRefresh && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        )}
        <button className="btn btn-ghost btn-sm" title="Notifications">
          <Bell size={14} />
        </button>
      </div>
    </header>
  );
}
