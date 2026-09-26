'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchSettings, fetchGmailStatus, updateSettings, triggerGmailSync, fetchSyncStatus, injectDemoData, Settings, SyncStatus } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Mail, Cpu, Bell, Shield, Database, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi<Settings>(fetchSettings);
  const { data: gmailStatus } = useApi<{ connected: boolean; status: string }>(fetchGmailStatus);

  const [slaMinutes, setSlaMinutes] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Check initial sync status on mount
  useEffect(() => {
    fetchSyncStatus()
      .then((status) => {
        setSyncStatus(status);
        if (status.is_syncing) {
          setSyncing(true);
          setFeedbackMsg(status.message || 'Gmail sync in progress...');
        }
      })
      .catch(() => {});
  }, []);

  // Poll sync status while sync is active
  useEffect(() => {
    if (!syncing) return;

    const interval = setInterval(async () => {
      try {
        const status = await fetchSyncStatus();
        setSyncStatus(status);
        if (status.message) {
          setFeedbackMsg(status.message);
        }
        if (!status.is_syncing) {
          setSyncing(false);
          if (status.status === 'completed') {
            setFeedbackMsg(status.message || `Successfully synced ${status.processed} emails from Gmail.`);
            refetch();
          } else if (status.status === 'failed') {
            setFeedbackMsg(`Gmail sync failed: ${status.error || status.message}`);
          }
        }
      } catch (err) {
        console.error('Error polling sync status:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [syncing, refetch]);

  const handleSave = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      await updateSettings({ sla_threshold_minutes: slaMinutes });
      setFeedbackMsg('Settings saved successfully.');
      refetch();
    } catch {
      setFeedbackMsg('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setFeedbackMsg('Starting background sync with Gmail…');
    try {
      const res = await triggerGmailSync(500);
      setFeedbackMsg(res.message);
    } catch (e: unknown) {
      setSyncing(false);
      setFeedbackMsg(e instanceof Error ? e.message : 'Gmail sync request failed.');
    }
  };

  const handleInject = async () => {
    setInjecting(true);
    setFeedbackMsg(null);
    try {
      const res = await injectDemoData();
      setFeedbackMsg(`Injected ${res.injected_count} simulated leads for testing.`);
    } catch {
      setFeedbackMsg('Injection failed.');
    } finally {
      setInjecting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div>
        <TopBar title="Settings" />
        <div style={{ padding: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, marginBottom: 16, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <TopBar title="Settings" subtitle="System configuration" onRefresh={refetch} />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
        {feedbackMsg && (
          <div
            style={{
              padding: '10px 16px',
              background: feedbackMsg.includes('fail') ? 'var(--danger-muted)' : 'var(--success-muted)',
              border: `1px solid ${feedbackMsg.includes('fail') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              color: feedbackMsg.includes('fail') ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {feedbackMsg}
          </div>
        )}

        {/* Gmail Integration */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Mail size={18} color="var(--accent-400)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Email Integration</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Provider</span>
              <div style={{ marginTop: 2 }}>{settings.email_account.provider}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Status</span>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="pulse-dot" style={{ background: gmailStatus?.connected ? 'var(--success)' : 'var(--danger)' }} />
                <span>{gmailStatus?.status || settings.email_account.status}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Syncing in Background…' : 'Sync Now'}
            </button>
            {syncing && syncStatus && syncStatus.total > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{syncStatus.current} / {syncStatus.total} emails</span>
                <span style={{ color: 'var(--accent-400)', fontWeight: 600 }}>({Math.round((syncStatus.current / syncStatus.total) * 100)}%)</span>
              </span>
            )}
          </div>
        </div>

        {/* AI Model */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Cpu size={18} color="var(--accent-400)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>AI Model</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Model</span>
              <div style={{ marginTop: 2 }}>{settings.ai_model.name}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Status</span>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="pulse-dot" style={{ background: 'var(--success)' }} />
                {settings.ai_model.status}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Version</span>
              <div style={{ marginTop: 2 }}>v{settings.ai_model.version}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Features</span>
              <div style={{ marginTop: 2 }}>{settings.ai_model.features}</div>
            </div>
          </div>
        </div>

        {/* SLA Configuration */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Shield size={18} color="var(--accent-400)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>SLA Configuration</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Response SLA threshold (minutes):</label>
            <input
              className="input"
              type="number"
              value={slaMinutes}
              onChange={(e) => setSlaMinutes(Number(e.target.value))}
              style={{ width: 100 }}
              min={5}
              max={1440}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {/* Notifications */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Bell size={18} color="var(--accent-400)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Notifications</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Email Alerts</span>
              <span className={`badge ${settings.notifications.email_alerts ? 'badge-success' : 'badge-neutral'}`}>
                {settings.notifications.email_alerts ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Critical Missed Lead Alerts</span>
              <span className={`badge ${settings.notifications.notify_on_critical_missed ? 'badge-success' : 'badge-neutral'}`}>
                {settings.notifications.notify_on_critical_missed ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Slack Webhook</span>
              <span className={`badge ${settings.notifications.slack_webhook ? 'badge-success' : 'badge-neutral'}`}>
                {settings.notifications.slack_webhook ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Demo Data */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Database size={18} color="var(--warning)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Development Tools</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Inject simulated lead emails for testing the detection and follow-up pipeline.
          </p>
          <button className="btn btn-outline btn-sm" onClick={handleInject} disabled={injecting}>
            <Database size={12} />
            {injecting ? 'Injecting…' : 'Inject Demo Leads'}
          </button>
        </div>
      </div>
    </div>
  );
}
