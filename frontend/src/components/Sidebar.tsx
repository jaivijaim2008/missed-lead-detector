'use client';

import {
  Home,
  Users,
  AlarmClock,
  MailCheck,
  Inbox,
  ChartLine,
  Workflow,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { fetchStats, DashboardStats } from '@/lib/api';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

/**
 * Plain-language navigation, ordered by "how soon a busy owner needs this":
 * daily triage first, housekeeping last. Counts come from the same stats
 * endpoint the Overview uses.
 */
export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { data: stats } = useApi<DashboardStats>(fetchStats);
  const waiting = stats?.missed_leads ?? 0;

  const items = [
    { id: 'overview', label: 'Today', icon: Home },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'missed', label: 'Waiting too long', icon: AlarmClock, badge: waiting || undefined },
    { id: 'followups', label: 'Follow-ups', icon: MailCheck },
    { id: 'emails', label: 'Inbox', icon: Inbox },
    { id: 'analytics', label: 'Trends', icon: ChartLine },
    { id: 'automations', label: 'Automations', icon: Workflow },
    { id: 'activity', label: 'History', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="md-sidebar">
      <div className="md-brand">
        <svg className="md-brand-dot" viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        </svg>
        LeadGuard
      </div>

      <nav className="md-nav" aria-label="Main">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`md-nav-item ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className="md-badge md-badge-attention"
                  style={{ marginLeft: 'auto', padding: '1px 7px' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="md-sidebar-foot">
        <span className="md-foot-dot" aria-hidden="true" />
        {stats ? 'Watching your inbox' : 'Starting up…'}
      </div>
    </aside>
  );
}
