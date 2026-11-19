import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  announcementState,
  hasAnnouncementErrors,
  validateAnnouncement,
  type AnnouncementDraft,
  type AnnouncementState,
} from '../inbox/announcementPlan';
import {
  AnnouncementConflictError,
  loadAnnouncements,
  sendAnnouncement,
  withdrawAnnouncement,
  type Announcement,
} from '../inbox/announcements';
import { formatDate, formatDateTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';

const EMPTY_DRAFT: AnnouncementDraft = { title: '', body: '', audience: 'all', showUntilDate: '' };

const AUDIENCE_LABELS = Object.fromEntries(ANNOUNCEMENT_AUDIENCES.map((a) => [a.value, a.label])) as Record<
  AnnouncementDraft['audience'],
  string
>;

const STATE_LABELS: Record<AnnouncementState, string> = {
  showing: 'Showing',
  ended: 'Ended',
  withdrawn: 'Withdrawn',
};

/** Today in the Philippines as 'YYYY-MM-DD' (the date input's minimum). */
function manilaToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof AnnouncementConflictError) return error.message;
  return (error as { code?: string }).code === 'permission-denied'
    ? 'The change was refused. Reload the page and try again.'
    : 'Could not save. Check your connection and try again.';
}

/**
 * Announcements: write one message for all users, passengers or drivers (optionally until a
 * date). It appears in the app inbox of everyone in that audience with a megaphone icon.
 * Sent announcements are listed newest first and can be withdrawn.
 */
export function AnnouncementsPage() {
  const { admin } = useAuth();
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [list, setList] = useState<Announcement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setList(null);
    setLoadError(null);
    try {
      setList(await loadAnnouncements());
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load announcements. Check your connection and reload the page.'));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const errors = validateAnnouncement(draft, Date.now());
  const shownErrors = touched ? errors : {};
  const update = (change: Partial<AnnouncementDraft>) => setDraft((d) => ({ ...d, ...change }));

  async function send() {
    if (!admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await sendAnnouncement(draft, admin.uid);
      setConfirmSend(false);
      setDraft(EMPTY_DRAFT);
      setTouched(false);
      setMessage(`Sent to ${AUDIENCE_LABELS[draft.audience].toLowerCase()}. It is in their inbox now.`);
      void reload();
    } catch (error) {
      setSaveError(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!admin || !withdrawing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await withdrawAnnouncement(withdrawing.announcementId, admin.uid);
      setMessage(`“${withdrawing.title}” was withdrawn. It no longer shows in the app.`);
      setWithdrawing(null);
      void reload();
    } catch (error) {
      setSaveError(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const now = Date.now();

  return (
    <div className="stack">
      <PageHeader
        title="Announcements"
        subtitle="One message to every user in an audience. It appears in their app inbox with a megaphone icon."
      />
      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      <section className="card stack" aria-labelledby="new-announcement">
        <h3 id="new-announcement">New announcement</h3>
        <label className="field" htmlFor="announcement-title">
          <span>Title</span>
          <input
            id="announcement-title"
            value={draft.title}
            maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH + 20}
            onChange={(e) => update({ title: e.target.value })}
            aria-invalid={shownErrors.title ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {shownErrors.title ? (
              <span className="field-error">{shownErrors.title}</span>
            ) : (
              `${draft.title.trim().length}/${ANNOUNCEMENT_TITLE_MAX_LENGTH}`
            )}
          </span>
        </label>
        <label className="field" htmlFor="announcement-body">
          <span>Message</span>
          <textarea
            id="announcement-body"
            rows={5}
            value={draft.body}
            onChange={(e) => update({ body: e.target.value })}
            aria-invalid={shownErrors.body ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {shownErrors.body ? (
              <span className="field-error">{shownErrors.body}</span>
            ) : (
              `${draft.body.trim().length}/${ANNOUNCEMENT_BODY_MAX_LENGTH}`
            )}
          </span>
        </label>
        <fieldset className="field">
          <legend>Audience</legend>
          <div className="segmented" role="group" aria-label="Audience">
            {ANNOUNCEMENT_AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                className="segmented-button"
                aria-pressed={draft.audience === a.value}
                onClick={() => update({ audience: a.value })}
                disabled={saving}
              >
                {a.label}
              </button>
            ))}
          </div>
          <span className="hint">{ANNOUNCEMENT_AUDIENCES.find((a) => a.value === draft.audience)?.hint}</span>
        </fieldset>
        <label className="field" htmlFor="announcement-until">
          <span>Show until (optional)</span>
          <input
            id="announcement-until"
            type="date"
            min={manilaToday()}
            value={draft.showUntilDate}
            onChange={(e) => update({ showUntilDate: e.target.value })}
            aria-invalid={shownErrors.showUntilDate ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {shownErrors.showUntilDate ? (
              <span className="field-error">{shownErrors.showUntilDate}</span>
            ) : (
              'Hidden from the app after the end of that day (Philippine time). Leave empty to show it until you withdraw it.'
            )}
          </span>
        </label>
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setTouched(true);
              setMessage(null);
              if (hasAnnouncementErrors(errors)) return;
              setSaveError(null);
              setConfirmSend(true);
            }}
            disabled={saving}
          >
            Send announcement…
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="sent-announcements">
        <h3 id="sent-announcements">Sent announcements</h3>
        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !list ? (
          <LoadingBlock label="Loading announcements…" />
        ) : list.length === 0 ? (
          <EmptyState>No announcements sent yet.</EmptyState>
        ) : (
          <>
            <p className="muted small" aria-live="polite">
              {plural(list.length, 'announcement')}
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Announcement</th>
                    <th scope="col">Audience</th>
                    <th scope="col">Sent</th>
                    <th scope="col">Show until</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const state = announcementState(a.status, a.showUntil?.getTime() ?? null, now);
                    return (
                      <tr key={a.announcementId}>
                        <td className="cell-wrap">
                          <div className="cell-strong">{a.title}</div>
                          <div className="muted small">{a.body}</div>
                        </td>
                        <td>{AUDIENCE_LABELS[a.audience]}</td>
                        <td>{formatDateTime(a.createdAt)}</td>
                        <td>{a.showUntil ? formatDate(a.showUntil) : 'Until withdrawn'}</td>
                        <td>
                          {state === 'withdrawn' ? `Withdrawn ${formatDateTime(a.withdrawnAt)}` : STATE_LABELS[state]}
                        </td>
                        <td className="cell-action">
                          {a.status === 'active' && (
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => {
                                setSaveError(null);
                                setMessage(null);
                                setWithdrawing(a);
                              }}
                              disabled={saving}
                            >
                              Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {confirmSend && (
        <ConfirmDialog
          title={`Send to ${AUDIENCE_LABELS[draft.audience].toLowerCase()}?`}
          confirmLabel="Send announcement"
          busy={saving}
          onConfirm={() => void send()}
          onCancel={() => setConfirmSend(false)}
        >
          <p>
            Everyone in this audience sees it in their app inbox
            {draft.showUntilDate ? ` until the end of ${draft.showUntilDate}` : ' until you withdraw it'}. The text
            cannot be edited after sending.
          </p>
          <blockquote className="remarks-quote">
            <strong>{draft.title.trim()}</strong>
            <br />
            {draft.body.trim()}
          </blockquote>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw this announcement?"
          confirmLabel="Withdraw"
          danger
          busy={saving}
          onConfirm={() => void withdraw()}
          onCancel={() => setWithdrawing(null)}
        >
          <p>“{withdrawing.title}” disappears from every inbox at once. It stays in this list as withdrawn.</p>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
