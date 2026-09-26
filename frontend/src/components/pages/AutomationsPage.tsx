'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchAutomations, triggerAutomation, Automation } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Zap, Play, Clock, CheckCircle } from 'lucide-react';

export default function AutomationsPage() {
  const { data, loading, refetch } = useApi<Automation[]>(fetchAutomations);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRun = async (ruleId: string) => {
    setRunning(ruleId);
    setMessage(null);
    try {
      const res = await triggerAutomation(ruleId);
      setMessage(res.message);
      refetch();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="fade-in">
      <TopBar title="Automations" subtitle="AI-powered automation rules" onRefresh={refetch} />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {message && (
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--success-muted)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              color: 'var(--success)',
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
          ))
        ) : !data || data.length === 0 ? (
          <div className="card empty-state">
            <Zap size={28} />
            <p>No automation rules configured.</p>
          </div>
        ) : (
          data.map((rule) => (
            <div key={rule.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Zap size={16} color="var(--accent-400)" />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{rule.name}</span>
                  <span className={`badge ${rule.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {rule.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {rule.action}
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> Trigger: {rule.trigger}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={11} /> Success: {rule.success_rate}
                  </span>
                  <span>Last run: {rule.last_run}</span>
                  <span>Next: {rule.next_run}</span>
                </div>
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleRun(rule.id)}
                disabled={running === rule.id}
              >
                <Play size={12} />
                {running === rule.id ? 'Running…' : 'Run Now'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
