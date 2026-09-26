'use client';

import { Fragment, useState } from 'react';
import { useApi, formatRelativeTime, riskColor } from '@/lib/hooks';
import { fetchLeads, updateLeadStatus, sendFollowUp, LeadListResponse } from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

const statusChips: Record<string, { label: string; badge: string }> = {
  new: { label: 'Needs reply', badge: 'md-badge-attention' },
  missed: { label: 'Waiting too long', badge: 'md-badge-attention' },
  followed_up: { label: 'On it', badge: 'md-badge-working' },
  resolved: { label: 'Handled', badge: 'md-badge-handled' },
  dismissed: { label: 'Not a lead', badge: 'md-badge-plain' },
};

export default function LeadsPage({ onViewDetail }: { onViewDetail?: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params: Record<string, string | number> = { page, limit: 15 };
  if (search) params.search = search;
  if (statusFilter !== 'all') params.status = statusFilter;
  if (riskFilter !== 'all') params.risk = riskFilter;

  const { data, loading, error, refetch } = useApi<LeadListResponse>(
    () => fetchLeads(params),
    [page, search, statusFilter, riskFilter]
  );

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    setBusyId(leadId);
    setActionError(null);
    try {
      await updateLeadStatus(leadId, newStatus);
      setActionNote(newStatus === 'resolved' ? 'Marked as handled. Nice work.' : 'Updated.');
      refetch();
    } catch {
      setActionError('That didn’t go through. Check the connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Actually sends the follow-up email (server marks the lead followed_up on success).
  const handleReply = async (leadId: number, name: string) => {
    setBusyId(leadId);
    setActionError(null);
    setActionNote(null);
    try {
      await sendFollowUp(leadId);
      setActionNote(`Follow-up sent to ${name}.`);
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'The follow-up didn’t send. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const hasFilters = search || statusFilter !== 'all' || riskFilter !== 'all';

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Leads</h1>
          <p className="md-pagehead-sub">
            {data
              ? `${data.total} lead${data.total === 1 ? '' : 's'} found · “Needs reply” means no one has answered yet`
              : 'Loading…'}
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        {actionError && (
          <div className="md-note md-note-bad" role="alert">{actionError}</div>
        )}
        {actionNote && !actionError && (
          <div className="md-note md-note-ok" role="status">{actionNote}</div>
        )}

        {/* Toolbar */}
        <div className="md-toolbar">
          <div className="md-search">
            <Search size={14} aria-hidden="true" />
            <input
              className="md-input"
              placeholder="Search by name, company, or subject…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Search leads"
            />
          </div>
          <select
            className="md-select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by status"
          >
            <option value="all">Any stage</option>
            <option value="new">Needs reply</option>
            <option value="missed">Waiting too long</option>
            <option value="followed_up">On it</option>
            <option value="resolved">Handled</option>
            <option value="dismissed">Not a lead</option>
          </select>
          <select
            className="md-select"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
            aria-label="Filter by urgency"
          >
            <option value="all">Any urgency</option>
            <option value="CRITICAL">Needs reply now</option>
            <option value="HIGH">Very urgent</option>
            <option value="MEDIUM">Urgent</option>
            <option value="LOW">Can wait</option>
          </select>
        </div>

        {/* Table */}
        <div className="md-tablecard">
          {loading ? (
            <div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="md-loadrow" />
              ))}
            </div>
          ) : error ? (
            <div className="md-error" style={{ margin: 20 }}>
              <strong>Couldn’t load your leads</strong>
              <span>Check that LeadGuard’s engine is running, then try again.</span>
              <code>cd app &amp;&amp; python api_server.py</code>
              <div>
                <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
              </div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 20px' }}>
              <Inbox size={28} style={{ color: 'var(--md-pencil)' }} />
              <p style={{ fontWeight: 600, color: 'var(--md-ink)', margin: '8px 0 4px' }}>
                {hasFilters ? 'No leads match those filters' : 'No leads yet'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--md-pencil-deep)', margin: 0 }}>
                {hasFilters
                  ? 'Try clearing the search or choosing a different stage.'
                  : 'When a sales lead lands in your inbox, it will appear here automatically.'}
              </p>
              {hasFilters && (
                <button
                  className="md-btn md-btn-quiet md-btn-md"
                  style={{ marginTop: 14 }}
                  onClick={() => { setSearch(''); setStatusFilter('all'); setRiskFilter('all'); setPage(1); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="md-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>About</th>
                    <th>Stage</th>
                    <th className="md-col-hide">Urgency</th>
                    <th className="md-col-hide">Waiting</th>
                    <th style={{ textAlign: 'right' }}>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((lead) => {
                    const chip = statusChips[lead.status] ?? statusChips.dismissed;
                    return (
                      <Fragment key={lead.id}>
                      <tr>
                        <td>
                          <div className="md-contact">
                            <b>{lead.name || lead.email}</b>
                            <span>{lead.company || lead.email}</span>
                          </div>
                        </td>
                        <td>
                          <div
                            className="md-cell-dim"
                            style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {lead.subject || '(no subject)'}
                          </div>
                        </td>
                        <td>
                          <span className={`md-badge ${chip.badge}`}>{chip.label}</span>
                        </td>
                        <td className="md-col-hide">
                          <span style={{ fontWeight: 600, fontSize: 12, color: riskColor(lead.risk) }}>
                            {lead.risk === 'CRITICAL' ? 'Reply now' : lead.risk === 'HIGH' ? 'Very urgent' : lead.risk === 'MEDIUM' ? 'Urgent' : 'Can wait'}
                          </span>
                        </td>
                        <td className="md-col-hide md-cell-dim">{formatRelativeTime(lead.received_at)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {lead.status === 'new' || lead.status === 'missed' ? (
                            <button
                              className="md-btn md-btn-primary md-btn-sm-inline"
                              disabled={busyId === lead.id}
                              onClick={() => handleReply(lead.id, lead.name || lead.company || lead.email)}
                            >
                              {busyId === lead.id ? 'Sending…' : 'Reply now'}
                            </button>
                          ) : lead.status === 'followed_up' ? (
                            <button
                              className="md-btn md-btn-quiet md-btn-sm-inline"
                              disabled={busyId === lead.id}
                              onClick={() => handleStatusChange(lead.id, 'resolved')}
                            >
                              They replied — mark handled
                            </button>
                          ) : (
                            <span className="md-cell-dim">Nothing needed</span>
                          )}
                          {onViewDetail && (
                            <button
                              className="md-btn md-btn-quiet md-btn-sm-inline"
                              style={{ marginLeft: 6 }}
                              onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                              aria-expanded={expandedId === lead.id}
                            >
                              {expandedId === lead.id ? 'Close' : 'Details'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === lead.id && (
                        <tr>
                          <td colSpan={6} style={{ background: '#FBFAF7' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '4px 2px' }}>
                              <div>
                                <b style={{ fontSize: 12, color: 'var(--md-pencil)' }}>FROM</b>
                                <div style={{ fontSize: 13 }}>{lead.sender_raw || lead.email}</div>
                              </div>
                              <div>
                                <b style={{ fontSize: 12, color: 'var(--md-pencil)' }}>RECEIVED</b>
                                <div style={{ fontSize: 13 }}>{formatRelativeTime(lead.received_at)} · {lead.days_waiting} day{lead.days_waiting === 1 ? '' : 's'} waiting</div>
                              </div>
                              <div>
                                <b style={{ fontSize: 12, color: 'var(--md-pencil)' }}>WHAT THEY WANT</b>
                                <div style={{ fontSize: 13 }}>{lead.intent || '—'} · {Math.round(lead.confidence)}% sure it's a lead</div>
                              </div>
                              <div>
                                <b style={{ fontSize: 12, color: 'var(--md-pencil)' }}>URGENCY</b>
                                <div style={{ fontSize: 13 }}>{lead.risk} · score {lead.risk_score}/100</div>
                              </div>
                            </div>
                            <div className="md-draft" style={{ marginTop: 10 }}>{lead.body}</div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pager */}
        {data && data.pages > 1 && (
          <div className="md-pager">
            <span>
              Page {data.page} of {data.pages} · {data.total} leads
            </span>
            <div className="md-pager-btns">
              <button className="md-btn md-btn-quiet md-btn-md" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} /> Back
              </button>
              <button className="md-btn md-btn-quiet md-btn-md" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
