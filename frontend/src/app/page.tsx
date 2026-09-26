'use client';

import { useEffect, useState } from 'react';
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

function pageFromHash(): string {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return h in pages ? h : 'overview';
}

export default function Home() {
  const [activePage, setActivePage] = useState('overview');

  // Hash-based navigation: deep links, browser back/forward and refresh all work.
  useEffect(() => {
    const sync = () => setActivePage(pageFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = (page: string) => {
    window.location.hash = `#/${page}`;
    setActivePage(page);
    window.scrollTo({ top: 0 });
  };

  const PageComponent = pages[activePage] || OverviewPage;

  return (
    <div className="md-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} />
      <main className="md-main">
        <PageComponent
          onViewDetail={(id: number) => {
            navigate('leads');
          }}
        />
      </main>
    </div>
  );
}
