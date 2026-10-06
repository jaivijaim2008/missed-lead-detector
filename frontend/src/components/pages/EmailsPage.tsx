'use client';

import { useState } from 'react';
import { useApi, formatRelativeTime } from '@/lib/hooks';
import { fetchEmails, classifyEmail, EmailListResponse } from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, Inbox, Wand2 } from 'lucide-react';

const categoryTabs = [
  { key: 'all', label: 'All' },
  { key: 'leads', label: 'Real leads' },
  { key: 'unanswered', label: 'Not answered yet' },
  { key: 'general', label: 'General' },
  { key: 'spam', label: 'Junk' },
];

const labelChip: Record<string, { label: string; badge: string }> = {
  lead: { label: 'Real lead', badge: 'md-badge-attention' },
  spam: { label: 'Junk', badge: 'md-badge-plain' },
  general: { label: 'General', badge: 'md-badge-plain' },
};

export default function EmailsPage({ onComposeReply }: { onComposeReply?: (draft: { to: string; subject: string }) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);

  const params: Record<string, string | number> = { page, limit: 20, category };
  if (search) params.search = search;

  const { data, loading, error, refetch } = useApi<EmailListResponse>(
    () => fetchEmails(params),
    [page, search, category]
  );

  const selectedEmail = data?.items.find((e) => e.id === selectedId);

  const handleClassify = async () => {
    if (!selectedEmail) return;
    setClassifying(true);
    setVerdict(null);
    setClassifyError(null);
    try {
      const res = await classifyEmail({
        sender: selectedEmail.sender,
        subject: selectedEmail.subject,
        body: selectedEmail.body,
      });
      const label =
        res.prediction === 'lead' ? 'a real sales lead' : res.prediction === 'spam' ? 'junk' : 'general mail';
      setVerdict(
        `LeadGuard thinks this is ${label} — about ${Math.round(res.confidence)}% sure. Suggested next step: ${
          res.suggested_draft ? 'a reply is ready in Follow-ups' : 'no reply needed'
        }.`
      );
    } catch {
      setClassifyError('The double-check didn’t run just now. Try again in a moment.');
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Inbox</h1>
          <p className="md-pagehead-sub">
            {data
              ? `${data.total} email${data.total === 1 ? '' : 's'} · LeadGuard has already sorted junk from real opportunities`
              : 'Loading…'}
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        {/* Search + tabs */}
        <div className="md-toolbar">
          <div className="md-search">
            <Search size={14} aria-hidden="true" />
            <input
              className="md-input"
              placeholder="Search your inbox…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Search emails"
            />
          </div>
          <div className="md-tabs" role="tablist" aria-label="Email categories">
            {categoryTabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={category === t.key}
                className={`md-tab ${category === t.key ? 'active' : ''}`}
                onClick={() => { setCategory(t.key); setPage(1); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1.1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
          {/* Mail list */}
          <div className="md-tablecard">
            {loading ? (
              <div>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="md-loadrow" style={{ margin: 0, borderRadius: 0 }} />
                ))}
              </div>
            ) : error ? (
              <div className="md-error" style={{ margin: 20 }}>
                <strong>Couldn’t load your inbox</strong>
                <span>Check that LeadGuard’s engine is running, then try again.</span>
                <code>cd app &amp;&amp; python api_server.py</code>
                <div>
                  <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
                </div>
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <Inbox size={28} style={{ color: 'var(--md-pencil)' }} />
                <p style={{ fontWeight: 600, color: 'var(--md-ink)', margin: '8px 0 4px' }}>
                  No emails here
                </p>
                <p style={{ fontSize: 13, color: 'var(--md-pencil-deep)', margin: 0 }}>
                  {search
                    ? 'Nothing matches that search. Try different words or clear it.'
                    : 'New mail will appear here as your inbox is checked.'}
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                {data.items.map((email) => {
                  const chip = labelChip[email.label] ?? labelChip.general;
                  return (
                    <button
                      key={email.id}
                      className={`md-mailrow ${email.id === selectedId ? 'is-open' : ''}`}
                      onClick={() => { setSelectedId(email.id === selectedId ? null : email.id); setVerdict(null); setClassifyError(null); }}
                      aria-pressed={email.id === selectedId}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--md-ink)' }}>
                            {email.sender_name || email.sender}
                          </span>
                          <span className={`md-badge ${chip.badge}`}>{chip.label}</span>
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--md-pencil)', whiteSpace: 'nowrap' }}>
                          {formatRelativeTime(email.received_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--md-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--md-pencil-deep)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.snippet}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reading pane */}
          {selectedEmail && (
            <div className="md-chart" style={{ position: 'sticky', top: 16 }}>
              <h3 style={{ marginBottom: 4 }}>{selectedEmail.subject}</h3>
              <p className="md-chart-sub" style={{ marginBottom: 10 }}>
                From {selectedEmail.sender_name || selectedEmail.sender}
                {selectedEmail.company ? ` · ${selectedEmail.company}` : ''} · {formatRelativeTime(selectedEmail.received_at)}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className={`md-badge ${(labelChip[selectedEmail.label] ?? labelChip.general).badge}`}>
                  {(labelChip[selectedEmail.label] ?? labelChip.general).label}
                </span>
                {selectedEmail.confidence > 0 && (
                  <span className="md-badge md-badge-plain">
                    {Math.round(selectedEmail.confidence)}% sure
                  </span>
                )}
                {selectedEmail.intent && (
                  <span className="md-badge md-badge-plain">Wants: {selectedEmail.intent}</span>
                )}
                {selectedEmail.priority && (
                  <span className="md-badge md-badge-plain">
                    {selectedEmail.priority === 'high' ? 'Urgent' : selectedEmail.priority === 'medium' ? 'Normal' : 'Relaxed'}
                  </span>
                )}
              </div>
              <div
                style={{
                  background: '#FBFAF7',
                  border: '1px solid var(--md-hair)',
                  borderRadius: 10,
                  padding: 16,
                  fontSize: 13.5,
                  lineHeight: 1.7,
                  color: 'var(--md-pencil-deep)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 340,
                  overflowY: 'auto',
                }}
              >
                {selectedEmail.body}
              </div>

              {/* Reply (own draft, pre-filled) */}
              {onComposeReply && (
                <button
                  className="md-btn md-btn-primary md-btn-md"
                  style={{ marginTop: 14 }}
                  onClick={() =>
                    onComposeReply({
                      to: selectedEmail.email,
                      subject: `Re: ${selectedEmail.subject || '(no subject)'}`,
                    })
                  }
                >
                  Reply
                </button>
              )}

              {/* Next step */}
              {selectedEmail.label === 'lead' ? (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="md-btn md-btn-primary md-btn-md" onClick={handleClassify} disabled={classifying}>
                    <Wand2 size={13} style={{ marginRight: 6 }} />
                    {classifying ? 'Double-checking…' : 'Double-check this one'}
                  </button>
                  <span style={{ fontSize: 12.5, color: 'var(--md-pencil-deep)' }}>
                    “Reply now” on the Leads page sends the ready-made note; “Reply” above opens your own draft.
                  </span>
                </div>
              ) : (
                <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--md-pencil-deep)', margin: '14px 0 0' }}>
                  No action needed — LeadGuard will keep watching this sender.
                </p>
              )}

              {verdict && (
                <div className="md-note md-note-ok" style={{ marginTop: 12, marginBottom: 0 }} role="status">
                  {verdict}
                </div>
              )}
              {classifyError && (
                <div className="md-note md-note-bad" style={{ marginTop: 12, marginBottom: 0 }} role="alert">
                  {classifyError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pager */}
        {data && data.pages > 1 && (
          <div className="md-pager">
            <span>Page {data.page} of {data.pages}</span>
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
