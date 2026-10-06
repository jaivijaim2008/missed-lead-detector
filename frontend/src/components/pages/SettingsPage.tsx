'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/hooks';
import {
  fetchSettings,
  fetchGmailStatus,
  updateSettings,
  triggerGmailSync,
  fetchSyncStatus,
  injectDemoData,
  Settings,
  SyncStatus,
} from '@/lib/api';
import { RefreshCw, Database, Mail, ShieldQuestion, Bell, FlaskConical } from 'lucide-react';

export default function SettingsPage() {
  const { data: settings, loading, error, refetch } = useApi<Settings>(fetchSettings);
  const { data: gmailStatus } = useApi<{ connected: boolean; status: string }>(fetchGmailStatus);

  const [slaMinutes, setSlaMinutes] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Pick up any sync already in progress on load
  useEffect(() => {
    fetchSyncStatus()
      .then((status) => {
        setSyncStatus(status);
        if (status.is_syncing) {
          setSyncing(true);
          setNote({ ok: true, text: status.message || 'Checking your Gmail now…' });
        }
      })
      .catch(() => {});
  }, []);

  // While a sync is running, keep asking how it's going
  useEffect(() => {
    if (!syncing) return;

    const interval = setInterval(async () => {
      try {
        const status = await fetchSyncStatus();
        setSyncStatus(status);
        if (status.message) {
          setNote({ ok: true, text: status.message });
        }
        if (!status.is_syncing) {
          setSyncing(false);
          if (status.status === 'completed') {
            setNote({
              ok: true,
              text: status.message || `All done — ${status.processed} emails checked from Gmail.`,
            });
            refetch();
          } else if (status.status === 'failed') {
            setNote({ ok: false, text: `The Gmail check didn’t finish: ${status.error || status.message}` });
          }
        }
      } catch {
        // keep polling; transient errors are fine
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [syncing, refetch]);

  // Keep the local input in sync with the saved value once loaded
  useEffect(() => {
    if (settings) setSlaMinutes(settings.sla_threshold_minutes);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setNote(null);
    try {
      await updateSettings({ sla_threshold_minutes: slaMinutes });
      setNote({ ok: true, text: 'Saved. New leads now get this long to hear from you.' });
      refetch();
    } catch {
      setNote({ ok: false, text: 'That didn’t save. Check the connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setNote({ ok: true, text: 'Starting a check of your Gmail now…' });
    try {
      const res = await triggerGmailSync(500);
      setNote({ ok: true, text: res.message });
    } catch (e: unknown) {
      setSyncing(false);
      setNote({
        ok: false,
        text: e instanceof Error ? e.message : 'The Gmail check didn’t start. Try again.',
      });
    }
  };

  const handleInject = async () => {
    setInjecting(true);
    setNote(null);
    try {
      const res = await injectDemoData();
      setNote({ ok: true, text: `Added ${res.injected_count} pretend leads so you can try things out.` });
    } catch {
      setNote({ ok: false, text: 'That didn’t work. Try again in a moment.' });
    } finally {
      setInjecting(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="md-theme">
        <header className="md-pagehead">
          <div>
            <h1>Settings</h1>
            <p className="md-pagehead-sub">Loading…</p>
          </div>
        </header>
        <div className="md-pagebody">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="md-loadrow" style={{ height: 90 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="md-theme">
        <header className="md-pagehead">
          <div>
            <h1>Settings</h1>
            <p className="md-pagehead-sub">Something went wrong</p>
          </div>
        </header>
        <div className="md-pagebody">
          <div className="md-error">
            <strong>Couldn’t load your settings</strong>
            <span>Check that LeadGuard’s engine is running, then try again.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  const connected = gmailStatus?.connected ?? settings.email_account.status === 'connected';

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Settings</h1>
          <p className="md-pagehead-sub">How LeadGuard watches your inbox and keeps its promises</p>
        </div>
      </header>

      <div className="md-pagebody" style={{ maxWidth: 760 }}>
        {note && (
          <div className={`md-note ${note.ok ? 'md-note-ok' : 'md-note-bad'}`} role="status">
            {note.text}
          </div>
        )}

        {/* Email connection */}
        <div className="md-chart" style={{ marginBottom: 16 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} style={{ color: 'var(--md-working)' }} /> Your email connection
          </h3>
          <p className="md-chart-sub">Where LeadGuard looks for new leads</p>
          <div className="md-kv">
            <div>
              <dt>Email provider</dt>
              <dd>{settings.email_account.provider === 'gmail' ? 'Gmail' : settings.email_account.provider}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  className="md-foot-dot"
                  style={{ background: connected ? 'var(--md-handled)' : 'var(--md-attention)' }}
                  aria-hidden="true"
                />
                {connected ? 'Connected and watching' : 'Not connected'}
              </dd>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="md-btn md-btn-quiet md-btn-md" onClick={handleSync} disabled={syncing}>
              <RefreshCw
                size={13}
                style={{ marginRight: 6, animation: syncing ? 'spin 1s linear infinite' : 'none' }}
              />
              {syncing ? 'Checking now…' : 'Check my Gmail now'}
            </button>
            {syncing && syncStatus && syncStatus.total > 0 && (
              <span style={{ fontSize: 13, color: 'var(--md-pencil-deep)' }}>
                {syncStatus.current} of {syncStatus.total} emails checked
                ({Math.round((syncStatus.current / syncStatus.total) * 100)}%)
              </span>
            )}
          </div>
        </div>

        {/* Reply promise */}
        <div className="md-chart" style={{ marginBottom: 16 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldQuestion size={16} style={{ color: 'var(--md-attention)' }} /> Your reply promise
          </h3>
          <p className="md-chart-sub">
            How long a new lead should wait before LeadGuard flags it as “waiting too long”
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <label htmlFor="sla-minutes" style={{ fontSize: 13.5, color: 'var(--md-ink)' }}>
              Promise every lead a reply within
            </label>
            <input
              id="sla-minutes"
              className="md-input"
              type="number"
              value={slaMinutes}
              onChange={(e) => setSlaMinutes(Number(e.target.value))}
              style={{ width: 92 }}
              min={5}
              max={1440}
            />
            <span style={{ fontSize: 13.5, color: 'var(--md-pencil-deep)' }}>minutes</span>
          </div>
          <button className="md-btn md-btn-primary md-btn-md" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save this promise'}
          </button>
        </div>

        {/* Notifications */}
        <div className="md-chart" style={{ marginBottom: 16 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} style={{ color: 'var(--md-working)' }} /> Alerts
          </h3>
          <p className="md-chart-sub">How LeadGuard taps you on the shoulder</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
            {[
              { label: 'Email me when a lead is about to slip away', on: settings.notifications.email_alerts },
              { label: 'Alert me the moment a big opportunity is missed', on: settings.notifications.notify_on_critical_missed },
              { label: 'Post updates to Slack', on: settings.notifications.slack_webhook },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--md-ink)' }}>{row.label}</span>
                <span className={`md-badge ${row.on ? 'md-badge-handled' : 'md-badge-plain'}`}>
                  {row.on ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* The brain */}
        <div className="md-chart" style={{ marginBottom: 16 }}>
          <h3>How LeadGuard reads your email</h3>
          <p className="md-chart-sub">The reader that sorts real leads from everything else</p>
          <div className="md-kv">
            <div>
              <dt>Reader</dt>
              <dd>{settings.ai_model.name}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{settings.ai_model.version}</dd>
            </div>
            <div>
              <dt>Safety net</dt>
              <dd>{settings.ai_model.fallback ?? 'Local fallback model'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  className="md-foot-dot"
                  style={{
                    background: settings.ai_model.status === 'active'
                      ? 'var(--md-handled)'
                      : 'var(--md-attention)',
                  }}
                  aria-hidden="true"
                />
                {settings.ai_model.status === 'active'
                  ? 'Working normally'
                  : settings.ai_model.status}
              </dd>
            </div>
            <div>
              <dt>What it does</dt>
              <dd>{settings.ai_model.features}</dd>
            </div>
          </div>
        </div>

        {/* Try it out */}
        <div className="md-chart" style={{ borderStyle: 'dashed' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={16} style={{ color: 'var(--md-pencil-deep)' }} /> Try it out
          </h3>
          <p className="md-chart-sub">
            Add a batch of pretend leads to see how LeadGuard handles them — nothing real is affected
          </p>
          <button className="md-btn md-btn-quiet md-btn-md" onClick={handleInject} disabled={injecting}>
            <Database size={13} style={{ marginRight: 6 }} />
            {injecting ? 'Adding…' : 'Add pretend leads'}
          </button>
        </div>
      </div>
    </div>
  );
}
