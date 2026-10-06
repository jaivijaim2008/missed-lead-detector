'use client';

/**
 * ComposeModal — free-form email composer (separate from the templated
 * "Send Follow-Up" button). Opens from the top-bar Compose button, or from
 * a row's Reply action (pre-filled To / Subject). State is preserved when
 * a send fails, so nothing the user typed is ever lost.
 *
 * Rendered through a React portal into <body> so it can never inherit
 * positioning or stacking context from page-level ancestors (transforms,
 * z-index games, sticky headers) — it looks identical from every page.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, AlertCircle } from 'lucide-react';
import { sendEmail } from '@/lib/api';

export interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
}

interface ComposeModalProps {
  open: boolean;
  /** Pre-filled values (from a Reply action). Applied each time the modal opens. */
  initial?: ComposeDraft | null;
  onClose: () => void;
  /** Called with the recipient after a successful send (for a confirmation banner). */
  onSent?: (recipient: string) => void;
}

export default function ComposeModal({ open, initial, onClose, onSent }: ComposeModalProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ to?: string; body?: string }>({});
  const toInputRef = useRef<HTMLInputElement>(null);

  // Fresh state each time the modal opens (pre-fill if opened via Reply)
  useEffect(() => {
    if (open) {
      setTo(initial?.to ?? '');
      setSubject(initial?.subject ?? '');
      setBody(initial?.body ?? '');
      setError(null);
      setFieldErrors({});
      setSending(false);
      toInputRef.current?.focus();
    }
  }, [open, initial]);

  // Close on Escape (but never while a send is in flight) + lock background scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, sending, onClose]);

  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSend = async () => {
    setError(null);

    // Basic validation — block empty To / Body (and a malformed To)
    const errs: { to?: string; body?: string } = {};
    if (!to.trim()) errs.to = 'Add a recipient.';
    else if (!emailOk(to)) errs.to = 'That doesn’t look like an email address.';
    if (!body.trim()) errs.body = 'Write a message before sending.';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSending(true);
    try {
      await sendEmail({
        to: to.trim(),
        subject: subject.trim() || '(no subject)',
        body,
      });
      onSent?.(to.trim());
      onClose();
    } catch (e) {
      // Keep the modal open and everything the user typed intact.
      setSending(false);
      setError(
        e instanceof Error
          ? e.message
          : 'The email didn’t send. Check the connection and try again.'
      );
    }
  };

  if (!open) return null;

  // Portal to <body>: identical rendering from every page, no inheritance.
  return createPortal(
    <div
      className="md-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        className="md-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
      >
        <header className="md-modal-head">
          <h2 id="compose-title">New email</h2>
          <button
            className="md-modal-close"
            onClick={onClose}
            disabled={sending}
            aria-label="Close without sending"
          >
            <X size={16} />
          </button>
        </header>

        <div className="md-modal-body">
          <div className="md-field">
            <label htmlFor="compose-to">To</label>
            <input
              id="compose-to"
              ref={toInputRef}
              className={`md-input ${fieldErrors.to ? 'is-invalid' : ''}`}
              type="email"
              placeholder="name@company.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
              autoComplete="off"
            />
            {fieldErrors.to && <p className="md-field-err">{fieldErrors.to}</p>}
          </div>

          <div className="md-field">
            <label htmlFor="compose-subject">Subject</label>
            <input
              id="compose-subject"
              className="md-input"
              type="text"
              placeholder="What is this about?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="md-field">
            <label htmlFor="compose-body">Message</label>
            <textarea
              id="compose-body"
              className={`md-input md-textarea ${fieldErrors.body ? 'is-invalid' : ''}`}
              placeholder="Write your email…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={9}
            />
            {fieldErrors.body && <p className="md-field-err">{fieldErrors.body}</p>}
          </div>

          {error && (
            <div className="md-note md-note-bad" role="alert">
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="md-modal-foot">
          <button
            className="md-btn md-btn-quiet md-btn-md"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            className="md-btn md-btn-primary md-btn-md"
            onClick={handleSend}
            disabled={sending || !to.trim() || !body.trim()}
          >
            <Send size={13} style={{ marginRight: 7 }} />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
