'use client';

import { useState } from 'react';
import { useApi, formatRelativeTime, riskColor, statusColor, priorityColor } from '@/lib/hooks';
import { fetchLeads, LeadListResponse, updateLeadStatus } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface LeadsPageProps {
  onViewDetail?: (leadId: number) => void;
}

export default function LeadsPage({ onViewDetail }: LeadsPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);

  const params: Record<string, string | number> = { page, limit: 15 };
  if (search) params.search = search;
  if (statusFilter !== 'all') params.status = statusFilter;
  if (riskFilter !== 'all') params.risk = riskFilter;

  const { data, loading, refetch } = useApi<LeadListResponse>(
    () => fetchLeads(params),
    [page, search, statusFilter, riskFilter]
  );

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      await updateLeadStatus(leadId, newStatus);
      refetch();
    } catch {
      // Could show toast error
    }
  };

  return (
    <div className="fade-in">
      <TopBar title="Leads" subtitle={data ? `${data.total} total leads` : 'Loading…'} onRefresh={refetch} />

      <div style={{ padding: 24 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 340 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
            />
            <input
              className="input"
              placeholder="Search by name, company, email, subject…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="missed">Missed</option>
            <option value="followed_up">Followed Up</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select className="select" value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}>
            <option value="all">All Risk Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Table */}
        <div className="card card-flush" style={{ overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, marginBottom: 2, borderRadius: 4 }} />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="empty-state">
              <p>No leads match your filters.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Risk</th>
                  <th>Confidence</th>
                  <th>Waiting</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{lead.company}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {lead.subject}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusColor(lead.status)}`}>{lead.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <span className={`badge ${priorityColor(lead.priority)}`}>{lead.priority}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="risk-bar">
                          <div
                            className="risk-bar-fill"
                            style={{ width: `${lead.risk_score}%`, background: riskColor(lead.risk) }}
                          />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: riskColor(lead.risk) }}>{lead.risk}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{lead.confidence}%</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatRelativeTime(lead.received_at)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {onViewDetail && (
                          <button className="btn btn-ghost btn-xs" onClick={() => onViewDetail(lead.id)} title="View details">
                            <ExternalLink size={12} />
                          </button>
                        )}
                        {lead.status === 'missed' && (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleStatusChange(lead.id, 'followed_up')}
                          >
                            Follow Up
                          </button>
                        )}
                        {lead.status === 'new' && (
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => handleStatusChange(lead.id, 'resolved')}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Page {data.page} of {data.pages} · {data.total} leads
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn btn-outline btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
