'use client';

import { useApi, formatRelativeTime } from '@/lib/hooks';
import { fetchActivity, Activity } from '@/lib/api';
import { ScrollText } from 'lucide-react';

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
  if (a.includes('sla')) return 'Reply-promise check';
  return action;
}

export default function ActivityPage() {
  const { data, loading, error, refetch } = useApi<Activity[]>(() => fetchActivity(100));

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>History</h1>
          <p className="md-pagehead-sub">
            Everything LeadGuard has done on your behalf, newest first
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        <div className="md-tablecard">
          {loading ? (
            <div>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="md-loadrow" style={{ margin: 0, borderRadius: 0 }} />
              ))}
            </div>
          ) : error ? (
            <div className="md-error" style={{ margin: 20 }}>
              <strong>Couldn’t load your history</strong>
              <span>Check that LeadGuard’s engine is running, then try again.</span>
              <code>cd app &amp;&amp; python api_server.py</code>
              <div>
                <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
              </div>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 20px' }}>
              <ScrollText size={28} style={{ color: 'var(--md-pencil)' }} />
              <p style={{ fontWeight: 600, color: 'var(--md-ink)', margin: '8px 0 4px' }}>
                Nothing recorded yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--md-pencil-deep)', margin: 0 }}>
                Once LeadGuard starts checking your inbox, everything it does will be listed here.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="md-table">
                <thead>
                  <tr>
                    <th style={{ width: 26 }} aria-label="Event type"></th>
                    <th>What happened</th>
                    <th className="md-col-hide">Details</th>
                    <th className="md-col-hide">By</th>
                    <th style={{ textAlign: 'right' }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: eventDot(a.action),
                          }}
                        />
                        <span className="sr-only">{eventDot(a.action) === 'var(--md-attention)' ? 'Needs attention' : 'Event'}</span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13.5 }}>{friendlyAction(a.action)}</td>
                      <td className="md-col-hide md-cell-dim" style={{ maxWidth: 420 }}>
                        <span style={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
                          {a.details}
                        </span>
                      </td>
                      <td className="md-col-hide md-cell-dim">
                        {a.actor === 'Lead Simulator' || a.actor === 'System' ? 'LeadGuard' : a.actor}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="md-cell-dim">
                        {formatRelativeTime(a.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
