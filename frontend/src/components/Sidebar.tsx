'use client';

import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Send,
  Mail,
  BarChart3,
  Settings,
  Zap,
  Activity,
  Shield,
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'missed', label: 'Missed Leads', icon: AlertTriangle },
  { id: 'followups', label: 'Follow-Ups', icon: Send },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            LeadGuard
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            AI Detection
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-link ${isActive ? 'active' : ''}`}
              style={{ border: 'none', textAlign: 'left', width: '100%' }}
            >
              <Icon className="nav-icon" size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div
        style={{
          padding: '16px 16px',
          borderTop: '1px solid var(--border-default)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div className="pulse-dot" style={{ background: 'var(--success)' }} />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
