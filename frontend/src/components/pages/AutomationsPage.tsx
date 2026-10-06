'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchAutomations, triggerAutomation, Automation } from '@/lib/api';
import { Play, Workflow } from 'lucide-react';

/** Plain-language pipeline view: same rules, explained the way they actually behave. */
const PIPELINE: Record<string, { step: number; name: string; plain: string; runsWhen?: string }> = {
  auto_gmail_sync: {
    step: 1,
    name: 'Checking your inbox',
    plain: 'Connects to Gmail every few minutes and brings in new mail.',
  },
  auto_priority_scoring: {
    step: 2,
    name: 'Sorting leads from noise',
    plain: 'Reads each email and decides whether it is a real opportunity, junk, or just everyday mail.',
  },
  auto_missed_lead_sla: {
    step: 3,
    name: 'Watching reply promises',
    plain: 'Every 15 minutes it checks whether any lead has waited too long to hear back from you.',
  },
  auto_followup_generator: {
    step: 4,
    name: 'Writing follow-ups',
    plain: 'When a lead waits too long, a ready-to-send note is drafted so replying takes one click.',
  },
};

function reliabilityPhrase(rate: string): string {
  const n = parseFloat(rate);
  if (isNaN(n)) return rate;
  if (n >= 99) return 'Working perfectly';
  if (n >= 90) return `Working well (${Math.round(n)}%)`;
  return `${Math.round(n)}% success`;
}

export default function AutomationsPage() {
  const { data, loading, error, refetch } = useApi<Automation[]>(fetchAutomations);
  const [running, setRunning] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const handleRun = async (ruleId: string) => {
    setRunning(ruleId);
    setNote(null);
    try {
      const res = await triggerAutomation(ruleId);
      setNote({ ok: true, text: res.message });
      refetch();
    } catch (e: unknown) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'That didn’t run. Try again.' });
    } finally {
      setRunning(null);
    }
  };

  // Order rules by their pipeline step; unknown rules go last.
  const rules = (data ?? []).slice().sort(
    (a, b) => (PIPELINE[a.id]?.step ?? 99) - (PIPELINE[b.id]?.step ?? 99)
  );

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Automations</h1>
          <p className="md-pagehead-sub">
            The background work LeadGuard does for you — set up once, running always
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        {note && (
          <div className={`md-note ${note.ok ? 'md-note-ok' : 'md-note-bad'}`} role="status">
            {note.text}
          </div>
        )}

        {/* The pipeline in plain words */}
        <div className="md-pipeline" aria-hidden="true">
          <div className="md-pipeline-step">
            <span className="md-auto-num">1</span>
            <span><b>Reads</b>every email that arrives</span>
          </div>
          <div className="md-pipeline-step">
            <span className="md-auto-num">2</span>
            <span><b>Decides</b>lead, junk, or everyday mail</span>
          </div>
          <div className="md-pipeline-step">
            <span className="md-auto-num">3</span>
            <span><b>Watches</b>reply promises on every lead</span>
          </div>
          <div className="md-pipeline-step">
            <span className="md-auto-num">4</span>
            <span><b>Reminds</b>drafts the follow-up for you</span>
          </div>
        </div>

        {loading ? (
          <div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="md-loadrow" />
            ))}
          </div>
        ) : error ? (
          <div className="md-error">
            <strong>Couldn’t load your automations</strong>
            <span>Check that LeadGuard’s engine is running, then try again.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="md-empty">
            <Workflow size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
            <strong>No automations set up yet</strong>
            <span>
              Automations are jobs LeadGuard does without being asked — like flagging
              leads that wait too long. They’ll be listed here once configured.
            </span>
          </div>
        ) : (
          <div className="md-tablecard">
            {rules.map((rule) => {
              const meta = PIPELINE[rule.id];
              const active = rule.status === 'active';
              return (
                <div key={rule.id} className="md-auto-row">
                  <span className="md-auto-num" style={meta ? undefined : { background: 'var(--md-pencil)' }}>
                    {meta?.step ?? '·'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="md-row-who" style={{ marginBottom: 3 }}>
                      <span>{meta?.name ?? rule.name}</span>
                      <span className={`md-badge ${active ? 'md-badge-handled' : 'md-badge-plain'}`}>
                        {active ? 'Running on its own' : 'Paused'}
                      </span>
                    </div>
                    <p className="md-cell-dim" style={{ margin: '0 0 8px' }}>
                      {meta?.plain ?? rule.action}
                    </p>
                    <div className="md-auto-meta">
                      <span>
                        <b>Runs when</b>
                        {meta?.runsWhen ?? rule.trigger}
                      </span>
                      <span>
                        <b>Last ran</b>
                        {rule.last_run}
                      </span>
                      <span>
                        <b>Up next</b>
                        {rule.next_run}
                      </span>
                      <span>
                        <b>Health</b>
                        {reliabilityPhrase(rule.success_rate)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="md-btn md-btn-quiet md-btn-md"
                    onClick={() => handleRun(rule.id)}
                    disabled={running === rule.id}
                  >
                    <Play size={12} style={{ marginRight: 6 }} />
                    {running === rule.id ? 'Running…' : 'Run it now'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
