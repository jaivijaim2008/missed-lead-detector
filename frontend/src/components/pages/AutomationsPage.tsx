'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchAutomations, triggerAutomation, Automation } from '@/lib/api';
import { Play, Workflow } from 'lucide-react';

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

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Automations</h1>
          <p className="md-pagehead-sub">
            The busywork LeadGuard handles for you — set it up once and it keeps working
          </p>
        </div>
      </header>

      <div className="md-pagebody">
        {note && (
          <div className={`md-note ${note.ok ? 'md-note-ok' : 'md-note-bad'}`} role="status">
            {note.text}
          </div>
        )}

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
            {data.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '15px 18px',
                  borderBottom: '1px solid var(--md-hair)',
                }}
              >
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="md-row-who" style={{ marginBottom: 4 }}>
                    <span>{rule.name}</span>
                    <span
                      className={`md-badge ${rule.status === 'active' ? 'md-badge-handled' : 'md-badge-plain'}`}
                    >
                      {rule.status === 'active' ? 'Running on its own' : 'Paused'}
                    </span>
                  </div>
                  <p className="md-cell-dim" style={{ margin: '0 0 6px' }}>{rule.action}</p>
                  <p className="md-row-meta" style={{ margin: 0 }}>
                    Kicks in when: {rule.trigger} · Works {rule.success_rate} of the time ·
                    Last ran {rule.last_run} · Next: {rule.next_run}
                  </p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
