'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ComposeModal, { ComposeDraft } from '@/components/ComposeModal';
import OverviewPage from '@/components/pages/OverviewPage';
import LeadsPage from '@/components/pages/LeadsPage';
import MissedLeadsPage from '@/components/pages/MissedLeadsPage';
import FollowUpsPage from '@/components/pages/FollowUpsPage';
import EmailsPage from '@/components/pages/EmailsPage';
import AnalyticsPage from '@/components/pages/AnalyticsPage';
import AutomationsPage from '@/components/pages/AutomationsPage';
import ActivityPage from '@/components/pages/ActivityPage';
import SettingsPage from '@/components/pages/SettingsPage';
import { PenLine, CheckCircle2, RefreshCw } from 'lucide-react';
import { triggerGmailSync, fetchSyncStatus } from '@/lib/api';

const pages: Record<string, React.ComponentType<PageProps>> = {
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

/** Props every page can accept — pages that don't use them just ignore them. */
interface PageProps {
  onViewDetail?: (id: number) => void;
  onComposeReply?: (draft: { to: string; subject: string }) => void;
}

function pageFromHash(): string {
  const h = window.location.hash.replace('#/', '').replace('#', '');
  return h in pages ? h : 'overview';
}

export default function Home() {
  const [activePage, setActivePage] = useState('overview');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeDraft | null>(null);
  const [sentBanner, setSentBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Open compose blank (top bar) or pre-filled (Reply on a row). */
  const openCompose = useCallback((draft?: ComposeDraft) => {
    setComposeInitial(draft ?? null);
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposeInitial(null);
  }, []);

  /** Success confirmation shown after the modal closes. */
  const handleSent = useCallback((recipient: string) => {
    setSentBanner(`Email sent to ${recipient}.`);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setSentBanner(null), 6000);
  }, []);

  const handleSyncTop = async () => {
    setSyncing(true);
    setSentBanner('Syncing real emails from Gmail…');
    try {
      await triggerGmailSync(100);
      const poll = setInterval(async () => {
        try {
          const s = await fetchSyncStatus();
          if (!s.is_syncing) {
            clearInterval(poll);
            setSyncing(false);
            setSentBanner(`Gmail sync complete (${s.processed} emails processed).`);
            if (bannerTimer.current) clearTimeout(bannerTimer.current);
            bannerTimer.current = setTimeout(() => setSentBanner(null), 6000);
          }
        } catch {
          clearInterval(poll);
          setSyncing(false);
        }
      }, 1500);
    } catch (e: unknown) {
      setSyncing(false);
      setSentBanner(e instanceof Error ? e.message : 'Gmail sync failed.');
    }
  };

  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const PageComponent = pages[activePage] || OverviewPage;

  return (
    <div className="md-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} />
      <main className="md-main">
        <header className="md-topbar">
          <span className="md-topbar-status">
            <span className="md-status-dot" aria-hidden="true" />
            {sentBanner ? sentBanner : 'Watching your inbox'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="md-btn md-btn-quiet md-btn-md"
              onClick={handleSyncTop}
              disabled={syncing}
              title="Sync Gmail inbox in one click"
            >
              <RefreshCw
                size={13}
                style={{ marginRight: 6, animation: syncing ? 'spin 1s linear infinite' : 'none' }}
              />
              {syncing ? 'Syncing…' : 'Sync Gmail'}
            </button>
            <button
              className="md-btn md-btn-primary md-btn-md"
              onClick={() => openCompose()}
            >
              <PenLine size={14} style={{ marginRight: 7 }} />
              Compose
            </button>
          </div>
        </header>
        {sentBanner && (
          <div className="md-toast" role="status" aria-live="polite">
            <CheckCircle2 size={15} style={{ color: 'var(--md-handled)', flexShrink: 0 }} />
            <span>{sentBanner}</span>
          </div>
        )}
        <PageComponent
          onViewDetail={(id: number) => {
            navigate('leads');
          }}
          onComposeReply={(draft) => openCompose({ to: draft.to, subject: draft.subject, body: '' })}
        />
      </main>

      <ComposeModal
        open={composeOpen}
        initial={composeInitial}
        onClose={closeCompose}
        onSent={handleSent}
      />
    </div>
  );
}
