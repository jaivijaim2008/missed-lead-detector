'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import OverviewPage from '@/components/pages/OverviewPage';
import LeadsPage from '@/components/pages/LeadsPage';
import MissedLeadsPage from '@/components/pages/MissedLeadsPage';
import FollowUpsPage from '@/components/pages/FollowUpsPage';
import EmailsPage from '@/components/pages/EmailsPage';
import AnalyticsPage from '@/components/pages/AnalyticsPage';
import AutomationsPage from '@/components/pages/AutomationsPage';
import ActivityPage from '@/components/pages/ActivityPage';
import SettingsPage from '@/components/pages/SettingsPage';

const pages: Record<string, React.ComponentType<{ onViewDetail?: (id: number) => void }>> = {
  overview: OverviewPage,
  leads: LeadsPage,
  missed: MissedLeadsPage,
  followups: FollowUpsPage,
  emails: EmailsPage,
  analytics: AnalyticsPage,
  automations: AutomationsPage,
  activity: ActivityPage,
  settings: SettingsPage,
};

export default function Home() {
  const [activePage, setActivePage] = useState('overview');

  const PageComponent = pages[activePage] || OverviewPage;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          minHeight: '100vh',
          background: 'var(--bg-root)',
        }}
      >
        <PageComponent
          onViewDetail={(id: number) => {
            // Navigate to leads page with detail - future enhancement
            setActivePage('leads');
          }}
        />
      </main>
    </div>
  );
}
