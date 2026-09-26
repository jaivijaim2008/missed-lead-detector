'use client';

import { useState } from 'react';
import { useApi, formatRelativeTime } from '@/lib/hooks';
import { fetchEmails, EmailListResponse } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Search, ChevronLeft, ChevronRight, Inbox, Tag } from 'lucide-react';

const categoryTabs = [
  { key: 'all', label: 'All' },
  { key: 'leads', label: 'Leads' },
  { key: 'unanswered', label: 'Unanswered' },
  { key: 'general', label: 'General' },
  { key: 'spam', label: 'Spam' },
];

export default function EmailsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const params: Record<string, string | number> = { page, limit: 20, category };
  if (search) params.search = search;

  const { data, loading, refetch } = useApi<EmailListResponse>(
    () => fetchEmails(params),
    [page, search, category]
  );

  const selectedEmail = data?.items.find((e) => e.id === selectedId);

  return (
    <div className="fade-in">
      <TopBar title="Emails" subtitle={data ? `${data.total} emails` : 'Loading…'} onRefresh={refetch} />

      <div style={{ padding: 24 }}>
        {/* Search + Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="input" placeholder="Search emails…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 34 }} />
          </div>
          <div className="tab-bar" style={{ borderBottom: 'none', gap: 0 }}>
            {categoryTabs.map((t) => (
              <button key={t.key} className={`tab-item ${category === t.key ? 'active' : ''}`} onClick={() => { setCategory(t.key); setPage(1); }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1fr' : '1fr', gap: 16 }}>
          {/* Email List */}
          <div className="card card-flush" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {loading ? (
              <div style={{ padding: 16 }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 56, marginBottom: 2, borderRadius: 4 }} />
                ))}
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="empty-state">
                <Inbox size={28} />
                <p>No emails match your criteria.</p>
              </div>
            ) : (
              <div>
                {data.items.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedId(email.id === selectedId ? null : email.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: email.id === selectedId ? 'rgba(59,130,246,0.06)' : 'transparent',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => {
                      if (email.id !== selectedId) e.currentTarget.style.background = 'rgba(148,163,184,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (email.id !== selectedId) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{email.sender_name}</span>
                        <span
                          className={`badge ${email.label === 'lead' ? 'badge-info' : email.label === 'spam' ? 'badge-danger' : 'badge-neutral'}`}
                        >
                          {email.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatRelativeTime(email.received_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Detail Panel */}
          {selectedEmail && (
            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{selectedEmail.subject}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className={`badge ${selectedEmail.label === 'lead' ? 'badge-info' : selectedEmail.label === 'spam' ? 'badge-danger' : 'badge-neutral'}`}>
                    <Tag size={10} /> {selectedEmail.label}
                  </span>
                  {selectedEmail.confidence > 0 && (
                    <span className="badge badge-neutral">{selectedEmail.confidence}% confidence</span>
                  )}
                  {selectedEmail.intent && <span className="badge badge-neutral">{selectedEmail.intent}</span>}
                  {selectedEmail.priority && <span className="badge badge-neutral">{selectedEmail.priority}</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <strong>From:</strong> {selectedEmail.sender}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <strong>Company:</strong> {selectedEmail.company}
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: 'var(--bg-surface-raised)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                }}
              >
                {selectedEmail.body}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {data.page} of {data.pages}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn btn-outline btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
