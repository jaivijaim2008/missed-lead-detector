'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchFollowUps, sendFollowUp, FollowUpsResponse } from '@/lib/api';
import { Send, CheckCircle2 } from 'lucide-react';

const tabs = [
  { key: 'pending', label: 'Ready to send' },
  { key: 'sent', label: 'Sent' },
  { key: 'upcoming', label: 'Scheduled' },
];

const PAGE_SIZE = 10;

export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [sending, setSending] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, loading, error, refetch } = useApi<FollowUpsResponse>(
    () => fetchFollowUps(activeTab),
    [activeTab]
  );

  const handleSend = async (leadId: number) => {
    setSending(leadId);
    setActionError(null);
    try {
      await sendFollowUp(leadId);
      refetch();
    } catch (e) {
      setActionError(
        e instanceof Error && e.message.length > 20
          ? `Didn’t send: ${e.message}`
          : 'The follow-up didn’t send. Check the connection and try again.'
      );
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Follow-ups</h1>
          <p className="md-pagehead-sub">
            {data
              ? activeTab === 'pending'
                ? `${data.total} note${data.total === 1 ? ' is' : 's are'} written and ready — sending them keeps the conversation alive`
                : `${data.total} ${activeTab === 'sent' ? 'already sent' : 'scheduled'}`
              : 'Loading…'}
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        {/* Tabs */}
        <div className="md-toolbar">
          <div className="md-tabs" role="tablist" aria-label="Follow-up stage">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`md-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setExpandedId(null); setVisibleCount(PAGE_SIZE); }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {actionError && (
          <div className="md-note md-note-bad" role="alert">{actionError}</div>
        )}

        {/* List */}
        {loading ? (
          <div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="md-loadrow" />
            ))}
          </div>
        ) : error ? (
          <div className="md-error">
            <strong>Couldn’t load follow-ups</strong>
            <span>Check that LeadGuard’s engine is running, then try again.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="md-empty">
            <CheckCircle2 size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
            <strong>
              {activeTab === 'pending'
                ? 'Nothing waiting to be sent'
                : activeTab === 'sent'
                  ? 'Nothing sent yet'
                  : 'Nothing scheduled'}
            </strong>
            <span>
              {activeTab === 'pending'
                ? 'When a lead waits too long, LeadGuard writes a follow-up for you — it will land here ready to send.'
                : activeTab === 'sent'
                  ? 'Sent follow-ups will show up here so you can see what went out.'
                  : 'Scheduled reminders will appear here.'}
            </span>
          </div>
        ) : (
          <div className="md-tablecard">
            {data.items.slice(0, visibleCount).map((item) => (
              <div key={item.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--md-hair)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="md-row-who" style={{ marginBottom: 3 }}>
                      <span>{item.lead_name || item.email}</span>
                      {item.company && (
                        <span style={{ fontWeight: 400, color: 'var(--md-pencil-deep)' }}>· {item.company}</span>
                      )}
                      <span className={`md-badge ${item.status === 'Sent' ? 'md-badge-working' : item.status === 'Pending' ? 'md-badge-attention' : 'md-badge-plain'}`}>
                        {item.status === 'Sent' ? 'Sent' : item.status === 'Pending' ? 'Ready to send' : item.status}
                      </span>
                    </div>
                    <p className="md-row-quote" style={{ margin: '2px 0 4px' }}>
                      {item.subject}
                    </p>
                    <p className="md-row-meta" style={{ margin: 0 }}>
                      To: {item.email} · written by {item.created_by === 'ai' ? 'LeadGuard' : item.created_by}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="md-btn md-btn-quiet md-btn-md"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      aria-expanded={expandedId === item.id}
                    >
                      {expandedId === item.id ? 'Hide note' : 'Read the note'}
                    </button>
                    {item.status === 'Pending' && (
                      <button
                        className="md-btn md-btn-primary md-btn-md"
                        onClick={() => handleSend(item.lead_id)}
                        disabled={sending === item.lead_id}
                      >
                        <Send size={13} style={{ marginRight: 6 }} />
                        {sending === item.lead_id ? 'Sending…' : 'Send now'}
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="md-draft">{item.draft_body}</div>
                )}
              </div>
            ))}
            {data.items.length > visibleCount && (
              <div style={{ textAlign: 'center', padding: 14 }}>
                <button
                  className="md-btn md-btn-quiet md-btn-md"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, data.items.length - visibleCount)} more
                  ({data.items.length - visibleCount} left)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
