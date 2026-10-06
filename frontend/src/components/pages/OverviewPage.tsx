'use client';

import { useState, useEffect } from 'react';
import { useApi, formatRelativeTime } from '@/lib/hooks';
import {
  fetchStats,
  fetchUrgentLeads,
  fetchActivity,
  fetchAnalytics,
  sendFollowUp,
  triggerGmailSync,
  fetchSyncStatus,
  DashboardStats,
  Activity,
  Lead,
  AnalyticsData,
  SyncStatus,
} from '@/lib/api';
import { palette as BI, chartTheme, handledLine } from '@/lib/palette';
import {
  useDateRange,
  RangeSwitch,
  KpiCard,
  ChartCard,
  FilterNote,
} from '@/lib/bi';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  PieChart as PieIcon,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

/* ─── Helpers ──────────────────────────────────────────────────── */

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

function promiseLeft(receivedAt: string, slaMinutes = 60): number {
  const t = new Date(receivedAt);
  if (isNaN(t.getTime())) return 1;
  const waitedMin = (Date.now() - t.getTime()) / 60000;
  return Math.max(0, Math.min(1, 1 - waitedMin / slaMinutes));
}

/** Sum a daily metric over the last `days` rows of an analytics series. */
function sumLast(data: AnalyticsData | null, key: 'leads' | 'missed' | 'followed_up' | 'emails', days: number): number {
  if (!data) return 0;
  return data.volume_trend.slice(-days).reduce((s, r) => s + (r[key] ?? 0), 0);
}

/** Status donut: where every lead stands right now (snapshot). */
function statusBreakdown(stats: DashboardStats | null) {
  if (!stats) return [];
  return [
    { key: 'attention', name: 'Needs reply', value: stats.pipeline.find((p) => p.stage === 'New')?.count ?? 0, color: BI.attention },
    { key: 'tense', name: 'Waiting too long', value: stats.missed_leads, color: BI.tense },
    { key: 'working', name: 'On it', value: stats.followups_sent, color: BI.working },
    { key: 'handled', name: 'Handled', value: stats.resolved_leads, color: BI.handled },
    { key: 'neutral', name: 'Not a lead', value: stats.pipeline.find((p) => p.stage === 'Lost')?.count ?? 0, color: BI.neutral },
  ].filter((d) => d.value > 0);
}

/** Follow-up funnel bars, mapped to the same cross-filter keys. */
function followupBars(stats: DashboardStats | null) {
  if (!stats) return [];
  return [
    { key: 'working', name: 'Sent', count: stats.followups_sent, color: BI.working },
    { key: 'tense', name: 'Waiting too long', count: stats.pending_followups, color: BI.tense },
    { key: 'attention', name: 'Awaiting first reply', count: stats.pipeline.find((p) => p.stage === 'New')?.count ?? 0, color: BI.pending },
  ];
}

type Focus = 'attention' | 'tense' | 'working' | 'handled' | 'neutral' | null;

const FOCUS_LABEL: Record<Exclude<Focus, null>, string> = {
  attention: 'Needs reply',
  tense: 'Waiting too long',
  working: 'On it (follow-up sent)',
  handled: 'Handled',
  neutral: 'Not a lead',
};

function activityMatchesFocus(a: Activity, focus: Focus): boolean {
  if (!focus) return true;
  const s = a.action.toLowerCase();
  if (focus === 'attention' || focus === 'tense') return s.includes('missed') || s.includes('sla') || s.includes('breach');
  if (focus === 'working') return s.includes('follow') || s.includes('sent');
  if (focus === 'handled') return s.includes('resolved') || s.includes('won');
  return s.includes('sync') || s.includes('checked') || s.includes('setting') || s.includes('automation');
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function OverviewPage() {
  const { range, setRange, resolved } = useDateRange('30');
  const { data: stats, loading, error, refetch } = useApi<DashboardStats>(fetchStats);
  const { data: urgent, refetch: refetchUrgent } = useApi<Lead[]>(fetchUrgentLeads);
  const { data: activity, refetch: refetchActivity } = useApi<Activity[]>(() => fetchActivity(60));
  // Current window + double-length window (first half = previous period, for trends).
  const { data: analytics } = useApi<AnalyticsData>(() => fetchAnalytics(range === '7' ? 7 : range === '30' ? 30 : 90), [range]);
  const { data: analytics2x } = useApi<AnalyticsData>(() => fetchAnalytics(range === '7' ? 14 : range === '30' ? 60 : 180), [range]);

  const [focus, setFocus] = useState<Focus>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendNote, setSendNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Poll sync status while syncing
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(async () => {
      try {
        const s = await fetchSyncStatus();
        if (s.message) {
          setSyncNote({ ok: s.status !== 'failed', text: s.message });
        }
        if (!s.is_syncing) {
          setSyncing(false);
          if (s.status === 'completed') {
            setSyncNote({ ok: true, text: `Done — ${s.processed} emails synced from Gmail.` });
            refetch();
            refetchUrgent();
            refetchActivity();
          } else if (s.status === 'failed') {
            setSyncNote({ ok: false, text: `Sync issue: ${s.error || s.message}` });
          }
        }
      } catch {
        // keep polling
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [syncing, refetch, refetchUrgent, refetchActivity]);

  const handleSyncGmail = async () => {
    setSyncing(true);
    setSyncNote({ ok: true, text: 'Connecting to Gmail inbox…' });
    try {
      const res = await triggerGmailSync(100);
      setSyncNote({ ok: true, text: res.message });
    } catch (e: unknown) {
      setSyncing(false);
      setSyncNote({
        ok: false,
        text: e instanceof Error ? e.message : 'Sync request failed. Try again.',
      });
    }
  };

  const handleReply = async (leadId: number, name: string) => {
    setSendingId(leadId);
    setSendNote(null);
    try {
      await sendFollowUp(leadId);
      setSendNote({ ok: true, text: `Follow-up sent to ${name}. They're now marked “on it.”` });
      refetch();
      refetchUrgent();
      refetchActivity();
    } catch (e) {
      setSendNote({ ok: false, text: e instanceof Error ? e.message : 'The follow-up didn’t send. Try again.' });
    } finally {
      setSendingId(null);
    }
  };

  const toggleFocus = (key: Focus) => setFocus((f) => (f === key ? null : key));

  const urgentLeadsAll = (urgent ?? []).sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );
  const worklistLeads = urgentLeadsAll.filter((l) => {
    if (focus === 'attention') return l.status === 'new';
    if (focus === 'tense') return l.status === 'missed';
    return true;
  });
  const visibleLeads = worklistLeads.slice(0, 6);
  const hiddenLeads = Math.max(0, worklistLeads.length - visibleLeads.length);
  const onItCount = (stats?.followups_sent ?? 0) + (stats?.resolved_leads ?? 0);

  const breakdown = statusBreakdown(stats);
  const bars = followupBars(stats);

  // Range-driven KPI values (real sums from the analytics endpoint).
  const kpis = [
    { label: 'Leads found', hint: 'in this period', cur: sumLast(analytics, 'leads', resolved.days), prev: sumLast(analytics2x, 'leads', resolved.days), color: BI.working },
    { label: 'Slipped past', hint: 'no reply in time', cur: sumLast(analytics, 'missed', resolved.days), prev: sumLast(analytics2x, 'missed', resolved.days), color: BI.attention },
    { label: 'Follow-ups sent', hint: 'in this period', cur: sumLast(analytics, 'followed_up', resolved.days), prev: sumLast(analytics2x, 'followed_up', resolved.days), color: BI.handled },
    { label: 'Emails read', hint: 'in this period', cur: sumLast(analytics, 'emails', resolved.days), prev: sumLast(analytics2x, 'emails', resolved.days), color: undefined },
  ];

  const headline = (() => {
    if (error) return 'We couldn’t check your inbox just now.';
    if (!stats) return null;
    const n = stats.missed_leads;
    if (n === 0) return <>{'You’re all caught up. '}<em>Nothing is waiting on you.</em></>;
    if (n === 1) return <>{'There is '}<em>1 lead</em>{' that hasn’t heard back from you.'}</>;
    return <>{'There are '}<em>{n} leads</em>{' that haven’t heard back from you.'}</>;
  })();

  const subline = (() => {
    if (error || !stats) return null;
    if (stats.missed_leads === 0)
      return `${stats.total_emails} emails checked · ${stats.spam_filtered} ignored as spam · ${stats.followups_sent} follow-ups sent`;
    const oldest = urgentLeadsAll.length ? waitingPhrase(urgentLeadsAll[0].received_at) : null;
    return oldest
      ? `The oldest has been waiting since ${oldest}. Replying within the hour wins them back.`
      : 'Replying within the hour is what wins them back.';
  })();

  const volumeSeries = analytics?.volume_trend ?? [];
  const focusSeriesOpacity = (seriesKey: 'leads' | 'missed' | 'followed_up') => {
    if (!focus) return 1;
    if (focus === 'working') return seriesKey === 'followed_up' ? 1 : 0.25;
    if (focus === 'attention' || focus === 'tense') return seriesKey === 'missed' ? 1 : 0.25;
    if (focus === 'handled') return seriesKey === 'followed_up' ? 1 : 0.25;
    return 0.25;
  };

  return (
    <div className="md-theme">
      {/* Opening */}
      <header className="md-opening" style={{ paddingBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--md-pencil-deep)', margin: '0 0 14px' }}>
              <span className={`md-status-dot ${error ? 'is-waiting' : ''}`} aria-hidden="true" />
              {error ? 'Inbox checking paused' : stats ? `Inbox checking on · ${stats.total_emails} emails read` : 'Checking your inbox…'}
            </p>
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
          </div>
          <button
            className="md-btn md-btn-quiet md-btn-md"
            onClick={handleSyncGmail}
            disabled={syncing}
            style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center' }}
            title="Fetch real emails from your Gmail inbox in one click"
          >
            <RefreshCw
              size={13}
              style={{ marginRight: 6, animation: syncing ? 'spin 1s linear infinite' : 'none' }}
            />
            {syncing ? 'Checking Gmail…' : 'Sync Gmail (1-Click)'}
          </button>
        </div>
        {syncNote && (
          <div
            className={`md-note ${syncNote.ok ? 'md-note-ok' : 'md-note-bad'}`}
            style={{ marginTop: 12, fontSize: 13 }}
            role="status"
          >
            {syncNote.text}
          </div>
        )}
      </header>

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 48px' }}>
          <div className="md-error" role="alert">
            <AlertTriangle size={22} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--md-attention)' }} />
            <strong>We couldn’t check your leads just now</strong>
            <span>LeadGuard couldn’t reach its own records. The rest of this page will fill in as soon as the connection is back.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{error}</span>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        </div>
      )}

      {!error && (
        <div className="md-pagebody" style={{ paddingTop: 6 }}>
          {/* Range switch + cross-filter chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
            <RangeSwitch value={range} onChange={(k) => { setRange(k); setFocus(null); }} />
            {focus && <FilterNote label={FOCUS_LABEL[focus]} onClear={() => setFocus(null)} />}
          </div>

          {/* KPI row with trends */}
          <div className="md-kpis">
            {kpis.map((k) => (
              <KpiCard
                key={k.label}
                label={k.label}
                hint={k.hint}
                value={k.cur.toLocaleString()}
                current={k.cur}
                previous={k.prev}
                color={k.color}
              />
            ))}
          </div>

          {/* Board: worklist + right-rail charts */}
          <div className="md-board" style={{ padding: 0, maxWidth: 'none' }}>
            <section className="md-worklist" aria-label="Leads that need a reply">
              {sendNote && (
                <div className={`md-note ${sendNote.ok ? 'md-note-ok' : 'md-note-bad'}`} role="status">
                  {sendNote.text}
                </div>
              )}

              {loading && !stats ? (
                <>
                  <div className="md-sentence-skeleton" style={{ height: 14, width: 150 }} />
                  <div className="md-sentence-skeleton" style={{ height: 74, width: '100%', marginTop: 12 }} />
                </>
              ) : focus === 'working' || focus === 'handled' || focus === 'neutral' ? (
                <div className="md-empty" style={{ textAlign: 'left' }}>
                  <strong>{FOCUS_LABEL[focus]}</strong>
                  <span>
                    {focus === 'working'
                      ? 'These leads already have a follow-up on the way. Their activity shows below and in the charts.'
                      : focus === 'handled'
                        ? 'Nothing to do here — these leads are already taken care of.'
                        : 'Junk and non-leads never need a reply. LeadGuard keeps them out of your way.'}
                  </span>
                </div>
              ) : worklistLeads.length === 0 ? (
                <div className="md-empty">
                  <CheckCircle2 size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <strong>You’re all caught up</strong>
                  <span>Every lead has had a reply or a follow-up. New ones will appear here the moment they arrive.</span>
                  <button className="md-btn md-btn-quiet md-btn-md" onClick={refetch}>Check again</button>
                </div>
              ) : (
                <>
                  <p className="md-marker md-marker-strong">
                    Needs you now <span className="md-marker-count">({worklistLeads.length})</span>
                  </p>
                  <div className="md-rows">
                    {visibleLeads.map((lead) => {
                      const left = promiseLeft(lead.received_at);
                      const waiting = waitingPhrase(lead.received_at);
                      const who = lead.company || lead.name || lead.email;
                      const person = lead.name && lead.company ? lead.name : null;
                      return (
                        <article key={lead.id} className={`md-row ${left > 0 ? 'is-urgent' : 'is-overdue'}`}>
                          <span className="md-row-rule" aria-hidden="true" />
                          <div className="md-row-main">
                            <div className="md-row-who">
                              <span>{who}</span>
                              {person && (
                                <>
                                  <span className="sep">·</span>
                                  <span style={{ fontWeight: 400, color: 'var(--md-pencil-deep)' }}>{person}</span>
                                </>
                              )}
                              <span className="md-chip md-chip-new">
                                {lead.status === 'missed' ? 'Waiting too long' : left > 0 ? 'Waiting for you' : 'Past the hour'}
                              </span>
                            </div>
                            <p className="md-row-quote">
                              “{lead.subject && lead.subject.length > 90 ? lead.subject.slice(0, 90).trimEnd() + '…' : lead.subject || '(no subject)'}”
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
                                {left > 0 ? `${Math.max(1, Math.round(left * 60))} min left to win them back` : 'past the 1-hour mark'}
                              </small>
                            </span>
                            <button
                              className="md-btn md-btn-primary md-btn-md"
                              onClick={() => handleReply(lead.id, who)}
                              disabled={sendingId === lead.id}
                            >
                              {sendingId === lead.id ? 'Sending…' : 'Reply now'}
                            </button>
                          </div>
                          <div className="md-meter" style={{ gridColumn: '1 / -1' }} aria-hidden="true">
                            <div className={`md-meter-fill ${left <= 0.15 ? 'is-tense' : ''}`} style={{ width: `${Math.max(3, left * 100)}%` }} />
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

              {/* Follow-up funnel bars (click = cross-filter) */}
              {stats && (
                <div style={{ marginTop: 30 }}>
                  <ChartCard
                    title="Follow-up progress"
                    subtitle="Click a stage to focus the whole page on it"
                  >
                    <div style={{ height: 150 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bars} layout="vertical" barSize={22} margin={{ left: 8, right: 24 }}>
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={150}
                            tick={{ ...chartTheme.axisTick, fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={chartTheme.tooltip}
                            formatter={(value, name) => [
                              `${value} lead${Number(value) === 1 ? '' : 's'}`,
                              String(name) === 'Sent' ? 'Follow-up sent' : String(name) === 'Waiting too long' ? 'Past the promise time' : 'No first reply yet',
                            ]}
                            cursor={{ fill: 'rgba(28,25,23,0.04)' }}
                          />
                          <Bar
                            dataKey="count"
                            radius={[0, 6, 6, 0]}
                            className="md-chart-bar-link"
                            onClick={(d: unknown) => {
                              const k = (d as { key?: string })?.key;
                              if (k) toggleFocus(k as Focus);
                            }}
                          >
                            {bars.map((b) => (
                              <Cell
                                key={b.key}
                                fill={b.color}
                                opacity={!focus || focus === b.key ? 1 : 0.3}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>
              )}
            </section>

            {/* Right rail */}
            <aside className="md-aside" aria-label="Charts">
              {stats ? (
                <>
                  <ChartCard
                    title="Where leads stand"
                    subtitle="Click a slice to focus the page"
                    footer={
                      breakdown.length
                        ? `${breakdown.reduce((s, d) => s + d.value, 0)} leads tracked · snapshot of right now`
                        : undefined
                    }
                  >
                    {breakdown.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}><span>No leads yet</span></div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <ResponsiveContainer width={130} height={130}>
                          <PieChart>
                            <Pie
                              data={breakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={38}
                              outerRadius={60}
                              dataKey="value"
                              strokeWidth={0}
                              className="md-chart-bar-link"
                              onClick={(d: unknown) => {
                                const k = (d as { key?: string })?.key;
                                if (k) toggleFocus(k as Focus);
                              }}
                            >
                              {breakdown.map((d) => (
                                <Cell key={d.key} fill={d.color} opacity={!focus || focus === d.key ? 1 : 0.3} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={chartTheme.tooltip}
                              formatter={(value, name) => [
                                `${value} lead${Number(value) === 1 ? '' : 's'}`,
                                FOCUS_LABEL[String(name) as Exclude<Focus, null>] ?? String(name),
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                          {breakdown.map((d) => (
                            <button
                              key={d.key}
                              onClick={() => toggleFocus(d.key as Focus)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                color: 'var(--md-ink)', fontFamily: 'var(--md-font-ui)',
                                opacity: !focus || focus === d.key ? 1 : 0.45,
                              }}
                            >
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                              <span style={{ color: 'var(--md-pencil-deep)' }}>{FOCUS_LABEL[d.key as Exclude<Focus, null>]}</span>
                              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{d.value}</b>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </ChartCard>

                  <ChartCard title="Emails coming in" subtitle={`Per day, last ${resolved.days} days`}>
                    <div style={{ height: 90 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={volumeSeries}>
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={chartTheme.tooltip}
                            formatter={(value) => [`${value} email${Number(value) === 1 ? '' : 's'}`, 'Checked that day']}
                            labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          />
                          <Area type="monotone" dataKey="emails" stroke={BI.neutral} fill={`${BI.neutral}22`} strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </>
              ) : (
                !error && (
                  <>
                    <div className="md-sentence-skeleton" style={{ height: 14, width: 90 }} />
                    <div className="md-sentence-skeleton" style={{ height: 40, width: '100%' }} />
                  </>
                )
              )}
            </aside>
          </div>

          {/* Volume over time (full width) */}
          {volumeSeries.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <ChartCard
                title="Volume over time"
                subtitle={`Last ${resolved.days} days — click the legend items to focus`}
                footer={
                  <>
                    <PieIcon size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Hover any point for exact daily numbers.
                  </>
                }
              >
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeSeries}>
                      <defs>
                        <linearGradient id="mdLeadsBi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BI.working} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={BI.working} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="mdMissedBi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BI.attention} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={BI.attention} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={chartTheme.axisTick}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      />
                      <Area type="monotone" dataKey="leads" name="Leads found" stroke={BI.working} fill="url(#mdLeadsBi)" strokeWidth={2} strokeOpacity={focusSeriesOpacity('leads')} />
                      <Area type="monotone" dataKey="missed" name="Slipped past" stroke={BI.attention} fill="url(#mdMissedBi)" strokeWidth={2} strokeOpacity={focusSeriesOpacity('missed')} />
                      <Area type="monotone" dataKey="followed_up" name="Follow-ups sent" stroke={handledLine} fill="none" strokeWidth={2.5} strokeDasharray="7 3" strokeOpacity={focusSeriesOpacity('followed_up')} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Recent activity (cross-filtered) */}
          <div style={{ marginTop: 26 }}>
            <ChartCard
              title="Recent activity"
              subtitle={focus ? `Showing only ${FOCUS_LABEL[focus].toLowerCase()} events` : 'What LeadGuard has done lately'}
            >
              {(activity ?? []).filter((a) => activityMatchesFocus(a, focus)).length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 0' }}>
                  <span>{focus ? `No ${FOCUS_LABEL[focus].toLowerCase()} events recently` : 'No activity yet'}</span>
                </div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {(activity ?? [])
                    .filter((a) => activityMatchesFocus(a, focus))
                    .slice(0, 12)
                    .map((a, idx, arr) => (
                      <div key={a.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--md-hair)' : 'none' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: focus ? BI[focus === 'neutral' ? 'neutral' : focus] : BI.neutral, marginTop: 6, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.action}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--md-pencil)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details}</div>
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--md-pencil)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatRelativeTime(a.timestamp)}</span>
                      </div>
                    ))}
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
