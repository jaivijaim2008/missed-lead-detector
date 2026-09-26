'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchMissedLeads, triggerSlaCheck, sendFollowUp, MissedLeadsResponse } from '@/lib/api';
import { Send, RefreshCw, CheckCircle2 } from 'lucide-react';

const urgencyWord: Record<string, string> = {
  CRITICAL: 'Slipping away now',
  HIGH: 'Very urgent',
  MEDIUM: 'Urgent',
  LOW: 'Can still wait',
};

const PAGE_SIZE = 10;

export default function MissedLeadsPage() {
  const [riskFilter, setRiskFilter] = useState('all');
  const [sending, setSending] = useState<number | null>(null);
  const [checkRunning, setCheckRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, loading, error, refetch } = useApi<MissedLeadsResponse>(
    () => fetchMissedLeads(riskFilter !== 'all' ? { risk: riskFilter } : undefined),
    [riskFilter]
  );

  const handleSlaCheck = async () => {
    setCheckRunning(true);
    setNote(null);
    try {
      const res = await triggerSlaCheck(60);
      setNote(
        res.newly_marked_missed > 0
          ? `Checked just now — ${res.newly_marked_missed} more lead${res.newly_marked_missed === 1 ? ' has' : 's have'} waited too long.`
          : 'Checked just now — nothing new has slipped past the promise time.'
      );
      refetch();
    } catch {
      setNote('The check didn’t run. Make sure LeadGuard’s engine is on and try again.');
    } finally {
      setCheckRunning(false);
    }
  };

  const handleSendFollowUp = async (leadId: number) => {
    setSending(leadId);
    setNote(null);
    try {
      await sendFollowUp(leadId);
      setNote('Follow-up sent. It moves to “On it” until they reply.');
      refetch();
    } catch {
      setNote('The follow-up didn’t send. Check the connection and try again.');
    } finally {
      setSending(null);
    }
  };

  const metrics = data?.metrics;

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Waiting too long</h1>
          <p className="md-pagehead-sub">
            {metrics
              ? `${metrics.total_missed} lead${metrics.total_missed === 1 ? ' has' : 's have'} waited past your reply promise — a quick follow-up usually wins them back`
              : 'Loading…'}
          </p>
        </div>
        <div className="md-pagehead-actions">
          <button className="md-btn md-btn-quiet md-btn-md" onClick={handleSlaCheck} disabled={checkRunning}>
            <RefreshCw size={13} style={{ marginRight: 6 }} />
            {checkRunning ? 'Checking…' : 'Check now'}
          </button>
        </div>
      </header>

      <div className="md-pagebody">
        {note && (
          <div className="md-note md-note-ok" role="status">{note}</div>
        )}

        {/* Plain-language totals */}
        {metrics && (
          <div className="md-statstrip">
            <div className="md-statstrip-item">
              <b className="is-bad">{metrics.total_missed}</b>
              <span>waiting too long</span>
            </div>
            <div className="md-statstrip-item">
              <b className="is-bad">{metrics.critical}</b>
              <span>slipping away now</span>
            </div>
            <div className="md-statstrip-item">
              <b>{metrics.detected_today}</b>
              <span>noticed today</span>
            </div>
            <div className="md-statstrip-item">
              <b className="is-good">{metrics.resolved}</b>
              <span>won back</span>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="md-toolbar">
          <select
            className="md-select"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            aria-label="Filter by urgency"
          >
            <option value="all">Any urgency</option>
            <option value="CRITICAL">Slipping away now</option>
            <option value="HIGH">Very urgent</option>
            <option value="MEDIUM">Urgent</option>
            <option value="LOW">Can still wait</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="md-loadrow" />
            ))}
          </div>
        ) : error ? (
          <div className="md-error">
            <strong>Couldn’t load these leads</strong>
            <span>Check that LeadGuard’s engine is running, then try again.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="md-empty">
            <CheckCircle2 size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
            <strong>Nothing is slipping away</strong>
            <span>
              Every lead has had a reply or a follow-up within your promise time.
              Run “Check now” anytime to look again.
            </span>
          </div>
        ) : (
          <div>
            {data.items.slice(0, visibleCount).map((lead) => (
              <article key={lead.id} className="md-urgent-card">
                <div style={{ minWidth: 0 }}>
                  <div className="md-row-who" style={{ marginBottom: 4 }}>
                    <span>{lead.company || lead.name}</span>
                    {lead.name && lead.company && (
                      <span style={{ fontWeight: 400, color: 'var(--md-pencil-deep)' }}>· {lead.name}</span>
                    )}
                    <span className="md-badge md-badge-attention">
                      {urgencyWord[lead.risk] ?? 'Urgent'}
                    </span>
                  </div>
                  <p className="md-row-quote" style={{ margin: '2px 0 6px' }}>
                    “{lead.subject}”
                  </p>
                  <p className="md-row-meta" style={{ margin: 0 }}>
                    Waiting {Math.round(lead.hours_overdue)} hour{Math.round(lead.hours_overdue) === 1 ? '' : 's'} past the promise ·
                    {' '}{lead.recommended_action}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    className="md-btn md-btn-primary md-btn-md"
                    onClick={() => handleSendFollowUp(lead.id)}
                    disabled={sending === lead.id}
                  >
                    <Send size={13} style={{ marginRight: 6 }} />
                    {sending === lead.id ? 'Sending…' : 'Send follow-up'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--md-pencil)', marginTop: 6 }}>
                    A ready-made note goes out
                  </div>
                </div>
              </article>
            ))}
            {data.items.length > visibleCount && (
              <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
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
