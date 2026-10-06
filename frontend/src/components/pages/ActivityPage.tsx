'use client';

import { Fragment, useMemo, useState } from 'react';
import { useApi, formatRelativeTime } from '@/lib/hooks';
import { fetchActivity, Activity } from '@/lib/api';
import { ScrollText, Search } from 'lucide-react';

/** Maps system events to the three-color language; neutral for housekeeping. */
function eventDot(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('missed') || a.includes('breach') || a.includes('sla')) return 'var(--md-attention)';
  if (a.includes('follow') || a.includes('sent') || a.includes('resolved') || a.includes('won')) return 'var(--md-handled)';
  if (a.includes('lead') || a.includes('detected')) return 'var(--md-working)';
  return 'var(--md-pencil)';
}

/** Plain-language version of each event a non-technical owner cares about. */
function friendlyAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('gmail synced') || a.includes('sync')) return 'Checked the inbox';
  if (a.includes('missed')) return 'Lead waited too long';
  if (a.includes('follow')) return 'Follow-up sent';
  if (a.includes('resolved')) return 'Lead won back';
  if (a.includes('retrained')) return 'Brain upgraded';
  if (a.includes('sla')) return 'Reply-promise check';
  return action;
}

type DayGroup = { dayKey: string; label: string; items: Activity[] };

function groupByDay(items: Activity[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const now = new Date();
  for (const a of items) {
    const d = new Date(a.timestamp);
    const key = isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
    if (!groups.has(key)) {
      let label: string;
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (key === 'unknown') label = 'Earlier';
      else if (daysAgo <= 0) label = 'Today';
      else if (daysAgo === 1) label = 'Yesterday';
      else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      groups.set(key, { dayKey: key, label, items: [] });
    }
    groups.get(key)!.items.push(a);
  }
  return [...groups.values()];
}

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'inbox', label: 'Inbox checks' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'progress', label: 'Follow-ups' },
];

function matchesFilter(a: Activity, f: string): boolean {
  if (f === 'all') return true;
  const s = a.action.toLowerCase();
  if (f === 'inbox') return s.includes('sync') || s.includes('summary') || s.includes('checked');
  if (f === 'attention') return s.includes('missed') || s.includes('sla') || s.includes('breach');
  if (f === 'progress') return s.includes('follow') || s.includes('sent') || s.includes('resolved');
  return true;
}

export default function ActivityPage() {
  const { data, loading, error, refetch } = useApi<Activity[]>(() => fetchActivity(100));
  const [filter, setFilter] = useState('all');

  const groups = useMemo(() => groupByDay((data ?? []).filter((a) => matchesFilter(a, filter))), [data, filter]);
  const total = data?.length ?? 0;

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>History</h1>
          <p className="md-pagehead-sub">
            {total
              ? `${total} things LeadGuard has done for you, newest first`
              : 'Everything LeadGuard does on your behalf will be listed here'}
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        <div className="md-toolbar">
          <div className="md-tabs" role="tablist" aria-label="Filter history">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`md-tab ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md-tablecard" style={{ padding: '18px 20px' }}>
          {loading ? (
            <div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="md-loadrow" style={{ margin: 0, borderRadius: 0 }} />
              ))}
            </div>
          ) : error ? (
            <div className="md-error" style={{ margin: 0 }}>
              <strong>Couldn’t load your history</strong>
              <span>Check that LeadGuard’s engine is running, then try again.</span>
              <code>cd app &amp;&amp; python api_server.py</code>
              <div>
                <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 20px' }}>
              <ScrollText size={28} style={{ color: 'var(--md-pencil)' }} />
              <p style={{ fontWeight: 600, color: 'var(--md-ink)', margin: '8px 0 4px' }}>
                Nothing in this view yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--md-pencil-deep)', margin: 0, maxWidth: 380 }}>
                {filter === 'all'
                  ? 'Once LeadGuard starts checking your inbox, a daily summary of everything it did will appear here.'
                  : 'Try another filter — or check back after LeadGuard has run for a while.'}
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.dayKey} style={{ marginBottom: 22 }}>
                <div className="md-day-head">
                  <span>{g.label}</span>
                  <span className="md-day-count">
                    {g.items.length} event{g.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                {g.items.map((a, i) => {
                  const t = new Date(a.timestamp);
                  const timeStr = isNaN(t.getTime()) ? '' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  return (
                    <div key={a.id} className="md-timeline-row">
                      <span className="md-timeline-rail" aria-hidden="true" />
                      <span className="md-timeline-dot" style={{ background: eventDot(a.action) }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--md-ink)' }}>
                          {friendlyAction(a.action)}
                        </div>
                        <div className="md-cell-dim" style={{ marginTop: 1 }}>{a.details}</div>
                      </div>
                      <span className="md-cell-dim" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeStr || formatRelativeTime(a.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
