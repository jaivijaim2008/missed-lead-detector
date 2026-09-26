'use client';

import { useApi, formatRelativeTime } from '@/lib/hooks';
import {
  fetchStats,
  fetchUrgentLeads,
  fetchActivity,
  DashboardStats,
  Activity,
  Lead,
} from '@/lib/api';
import { Clock, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

// ─── Small helpers ───────────────────────────────────────────────

/** "4 minutes ago" style phrasing a business owner would use. */
function waitingPhrase(receivedAt: string): string {
  const t = new Date(receivedAt);
  if (isNaN(t.getTime())) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - t.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return rem ? `${hrs}h ${rem}m ago` : `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** How much of the 60-minute reply promise is left, 0–1. */
function promiseLeft(receivedAt: string, slaMinutes = 60): number {
  const t = new Date(receivedAt);
  if (isNaN(t.getTime())) return 1;
  const waitedMin = (Date.now() - t.getTime()) / 60000;
  return Math.max(0, Math.min(1, 1 - waitedMin / slaMinutes));
}

/** Last 7 days of email volume for the sparkline. */
function last7Days(stats: DashboardStats | null, activity: Activity[] | null): number[] {
  const days = new Array(7).fill(0);
  if (activity) {
    for (const a of activity) {
      const t = new Date(a.timestamp);
      if (!isNaN(t.getTime())) {
        const d = Math.floor((Date.now() - t.getTime()) / 86400000);
        if (d >= 0 && d < 7) days[6 - d]++;
      }
    }
  }
  const total = days.reduce((s, n) => s + n, 0);
  if (stats && stats.total_emails > total) days[0] += stats.total_emails - total;
  return days;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Page ────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data: stats, loading, error, refetch } = useApi<DashboardStats>(fetchStats);
  const { data: urgent } = useApi<Lead[]>(() => fetchUrgentLeads().then((r) => r.items));
  const { data: activity } = useApi<Activity[]>(() => fetchActivity(60));

  const urgentLeadsAll = urgent ?? [];
  // Most overdue first — the top of the list is the lead closest to being lost.
  const urgentLeads = [...urgentLeadsAll].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );
  const visibleLeads = urgentLeads.slice(0, 6);
  const hiddenLeads = Math.max(0, urgentLeads.length - visibleLeads.length);
  const onItCount = (stats?.followups_sent ?? 0) + (stats?.resolved_leads ?? 0);
  const inboxBars = last7Days(stats, activity);
  const maxBar = Math.max(1, ...inboxBars);

  const headline = (() => {
    if (error) return 'We couldn’t check your inbox just now.';
    if (!stats) return null;
    const n = stats.missed_leads;
    if (n === 0) return <>{'You’re all caught up. '}<em>Nothing is waiting on you.</em></>;
    if (n === 1) return <>{'There is '}<em>1 lead</em>{' that hasn’t heard back from you.'}</>;
    return <>{'There are '}<em>{n} leads</em>{' that haven’t heard back from you.'}</>;
  })();

  const subline = (() => {
    if (error) return null;
    if (!stats) return null;
    const total = stats.missed_leads;
    if (total === 0) return `${stats.total_emails} emails checked · ${stats.spam_filtered} ignored as spam · ${stats.followups_sent} follow-ups sent`;
    const oldest = urgentLeads.length
      ? waitingPhrase(urgentLeads[0].received_at)
      : null;
    return oldest
      ? `The oldest has been waiting since ${oldest}. Replying within the hour wins them back.`
      : `Replying within the hour is what wins them back.`;
  })();

  const refreshAll = () => {
    refetch();
  };

  return (
    <div className="md-theme">
      {/* ── In-page top bar ── */}
      <div className="md-topbar">
        <span className="md-wordmark">
          <svg className="md-wordmark-dot" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </svg>
          LeadGuard
        </span>
        <span className="md-topbar-status">
          <span
            className={`md-status-dot ${error ? 'is-waiting' : ''}`}
            aria-hidden="true"
          />
          {error
            ? 'Inbox checking paused'
            : stats
              ? `Inbox checking on · ${stats.total_emails} emails read`
              : 'Checking your inbox…'}
        </span>
      </div>

      {/* ── Opening sentence ── */}
      <header className="md-opening">
        {loading && !stats ? (
          <>
            <div className="md-sentence-skeleton" />
            <div className="md-sentence-skeleton" style={{ width: 'min(420px, 60%)', height: 22 }} />
          </>
        ) : (
          <>
            <h1 className="md-sentence">{headline ?? 'Checking your inbox…'}</h1>
            {subline && <p className="md-subline">{subline}</p>}
          </>
        )}
      </header>

      {/* ── Error state ── */}
      {error && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 48px' }}>
          <div className="md-error" role="alert">
            <AlertTriangle size={22} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--md-attention)' }} />
            <strong>We couldn’t check your leads just now</strong>
            <span>
              LeadGuard couldn’t reach its own records. The rest of this page will
              fill in as soon as the connection is back.
            </span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{error}</span>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refreshAll}>
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── The board ── */}
      {!error && (
        <div className="md-board">
          {/* Worklist */}
          <section className="md-worklist" aria-label="Leads that need a reply">
            {loading && !stats ? (
              <>
                <div className="md-sentence-skeleton" style={{ height: 14, width: 150 }} />
                <div className="md-sentence-skeleton" style={{ height: 74, width: '100%', marginTop: 12 }} />
                <div className="md-sentence-skeleton" style={{ height: 74, width: '100%', marginTop: 10 }} />
              </>
            ) : urgentLeads.length === 0 ? (
              <div className="md-empty">
                <CheckCircle2 size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
                <strong>You’re all caught up</strong>
                <span>
                  Every lead in your inbox has had a reply or a follow-up.
                  New ones will appear here the moment they arrive.
                </span>
                <button className="md-btn md-btn-quiet md-btn-md" onClick={refreshAll}>
                  <RefreshCw size={14} style={{ marginRight: 7 }} />
                  Check again
                </button>
              </div>
            ) : (
              <>
                <p className="md-marker md-marker-strong">
                  Needs you now <span className="md-marker-count">({urgentLeads.length})</span>
                </p>
                <div className="md-rows">
                  {visibleLeads.map((lead) => {
                    const left = promiseLeft(lead.received_at);
                    const waiting = waitingPhrase(lead.received_at);
                    const who = lead.company || lead.name || lead.email;
                    const person = lead.name && lead.company ? lead.name : null;
                    return (
                      <article
                        key={lead.id}
                        className={`md-row ${left > 0 ? 'is-urgent' : 'is-overdue'}`}
                      >
                        <span className="md-row-rule" aria-hidden="true" />
                        <div className="md-row-main">
                          <div className="md-row-who">
                            <span>{who}</span>
                            {person && (
                              <>
                                <span className="sep">·</span>
                                <span style={{ fontWeight: 400, color: 'var(--md-pencil-deep)' }}>
                                  {person}
                                </span>
                              </>
                            )}
                            <span className="md-chip md-chip-new">
                              {left > 0 ? 'Waiting for you' : 'Past the hour'}
                            </span>
                          </div>
                          <p className="md-row-quote">
                            “{lead.subject && lead.subject.length > 90
                              ? lead.subject.slice(0, 90).trimEnd() + '…'
                              : lead.subject || '(no subject)'}”
                          </p>
                          <p className="md-row-meta">
                            {lead.intent && <>{lead.intent} · </>}
                            about {lead.confidence ? Math.round(lead.confidence) : '—'}% likely a real lead
                          </p>
                        </div>
                        <div className="md-row-side">
                          <span className={`md-waiting ${left <= 0.15 ? 'is-critical' : ''}`}>
                            <span className="md-waiting-top">
                              <Clock className="md-clock" size={14} aria-hidden="true" />
                              {waiting}
                            </span>
                            <small>
                              {left > 0
                                ? `${Math.max(1, Math.round(left * 60))} min left to win them back`
                                : 'past the 1-hour mark'}
                            </small>
                          </span>
                          <button className="md-btn md-btn-primary md-btn-md">Reply now</button>
                        </div>
                        <div className="md-meter" style={{ gridColumn: '1 / -1' }} aria-hidden="true">
                          <div
                            className={`md-meter-fill ${left <= 0.15 ? 'is-tense' : ''}`}
                            style={{ width: `${Math.max(3, left * 100)}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                {hiddenLeads > 0 && (
                  <p className="md-more">
                    …and {hiddenLeads} more lead{hiddenLeads === 1 ? ' is' : 's are'} waiting.
                    Open <b>Leads</b> in the sidebar to work through them.
                  </p>
                )}
              </>
            )}

            {/* On it — quiet strip */}
            {stats && onItCount > 0 && (
              <div className="md-onit">
                <p className="md-marker">
                  On it <span className="md-marker-count">({onItCount})</span>
                  <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>
                    — follow-up sent, waiting to hear back
                  </span>
                </p>
                <div className="md-onit-list">
                  {(activity ?? [])
                    .filter((a) => a.action.toLowerCase().includes('follow'))
                    .slice(0, 3)
                    .map((a) => (
                      <div className="md-onit-row" key={a.id}>
                        <span className="md-onit-name">
                          Follow-up sent · <b>{a.details.slice(0, 42) || 'lead'}</b>
                        </span>
                        <span className="md-onit-when">{formatRelativeTime(a.timestamp)}</span>
                      </div>
                    ))}
                  {(activity ?? []).filter((a) => a.action.toLowerCase().includes('follow')).length === 0 && (
                    <div className="md-onit-row">
                      <span className="md-onit-name">{onItCount} follow-ups sent — replies usually land within a day</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Right rail */}
          <aside className="md-aside" aria-label="This week in numbers">
            {stats ? (
              <>
                <div className="md-ledger">
                  <p className="md-marker">This week</p>
                  <div className="md-ledger-row">
                    <span className="md-ledger-label">
                      Leads found
                      <small>real opportunities, not spam</small>
                    </span>
                    <span className="md-ledger-num">{stats.total_leads}</span>
                  </div>
                  <div className="md-ledger-row">
                    <span className="md-ledger-label">
                      Won back
                      <small>replied and resolved</small>
                    </span>
                    <span className="md-ledger-num is-good">{stats.resolved_leads}</span>
                  </div>
                  <div className="md-ledger-row">
                    <span className="md-ledger-label">
                      Follow-ups sent
                      <small>waiting on a reply</small>
                    </span>
                    <span className="md-ledger-num" style={{ color: 'var(--md-working)' }}>
                      {stats.followups_sent}
                    </span>
                  </div>
                  <div className="md-ledger-row" style={{ borderBottom: 'none' }}>
                    <span className="md-ledger-label">
                      Ignored as spam
                      <small>kept out of your way</small>
                    </span>
                    <span className="md-ledger-num" style={{ color: 'var(--md-pencil)' }}>
                      {stats.spam_filtered}
                    </span>
                  </div>
                  <p className="md-ledger-total">
                    {stats.missed_leads > 0
                      ? `${stats.missed_leads} lead${stats.missed_leads === 1 ? '' : 's'} still waiting on the left.`
                      : 'Nothing is waiting. That green bar is your streak.'}
                  </p>
                </div>

                {stats.missed_leads === 0 && (
                  <div className="md-caughtup">
                    ✓ <b>Inbox clear.</b> Every lead has been answered or is being followed up.
                  </div>
                )}

                <div className="md-spark">
                  <p className="md-spark-title">
                    <b>Emails coming in</b> — last 7 days
                  </p>
                  <div className="md-spark-bars" role="img" aria-label="Email volume, last 7 days">
                    {inboxBars.map((v, i) => (
                      <div
                        key={i}
                        className={`md-spark-bar ${i === 6 ? 'is-today' : ''}`}
                        style={{ height: `${Math.max(6, (v / maxBar) * 100)}%` }}
                        title={`${v} emails`}
                      />
                    ))}
                  </div>
                  <div className="md-spark-caption">
                    <span>6 days ago</span>
                    <span>today</span>
                  </div>
                </div>
              </>
            ) : (
              !error && (
                <>
                  <div className="md-sentence-skeleton" style={{ height: 14, width: 90 }} />
                  <div className="md-sentence-skeleton" style={{ height: 40, width: '100%' }} />
                  <div className="md-sentence-skeleton" style={{ height: 40, width: '100%' }} />
                </>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
