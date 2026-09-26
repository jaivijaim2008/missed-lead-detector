'use client';

import { useApi, formatRelativeTime } from '@/lib/hooks';
import { fetchActivity, Activity } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Activity as ActivityIcon } from 'lucide-react';

function activityDotColor(action: string): string {
  if (action.includes('Missed') || action.includes('Breached') || action.includes('SLA')) return '#ef4444';
  if (action.includes('Follow') || action.includes('Sent') || action.includes('Resolved')) return '#10b981';
  if (action.includes('Lead') || action.includes('Detected')) return '#3b82f6';
  if (action.includes('Automation') || action.includes('Sync')) return '#8b5cf6';
  if (action.includes('Setting') || action.includes('System')) return '#f59e0b';
  return '#64748b';
}

export default function ActivityPage() {
  const { data, loading, refetch } = useApi<Activity[]>(() => fetchActivity(100));

  return (
    <div className="fade-in">
      <TopBar title="Activity Log" subtitle="System audit trail" onRefresh={refetch} />

      <div style={{ padding: 24 }}>
        <div className="card card-flush" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 4, borderRadius: 4 }} />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="empty-state">
              <ActivityIcon size={28} />
              <p>No activity recorded yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 8 }}></th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Actor</th>
                  <th>Lead</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: activityDotColor(a.action),
                        }}
                      />
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{a.action}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.details}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{a.actor}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        {a.lead_id ? `#${a.lead_id}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {formatRelativeTime(a.timestamp)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
