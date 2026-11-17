import { useEffect, type ReactNode } from 'react';

import { useAuth } from '../../auth/AuthContext';
import { formatDateTime } from '../../lib/format';
import {
  changeWarningText,
  unsavedChangesLabel,
  type ChangeRow,
  type FieldError,
} from '../../settings/settingsDiff';
import { ConfirmDialog } from '../ConfirmDialog';

// Shared pieces of the Settings tabs' edit flow: header with "Last updated", sections,
// fields with a "was …" hint, the sticky save bar, the review dialog and a toast.

export const NOT_SAVED_YET_TEXT = 'Not saved yet — the app uses built-in defaults';

/** "Last updated <date, time> by you" / "… by another admin" (updatedBy is an admin UID). */
export function LastUpdated({ updatedAt, updatedBy }: { updatedAt: Date | null; updatedBy: string | null }) {
  const { admin } = useAuth();
  const by = updatedBy ? (updatedBy === admin?.uid ? ' by you' : ' by another admin') : '';
  return <>{`Last updated ${updatedAt ? formatDateTime(updatedAt) : 'at an unknown time'}${by}`}</>;
}

/** Page title, one helper sentence and an optional muted line (usually <LastUpdated>). */
export function SettingsHeader({ title, helper, meta }: { title: string; helper: ReactNode; meta?: ReactNode }) {
  return (
    <header className="settings-header">
      <h2 className="page-title">{title}</h2>
      <p className="settings-helper">{helper}</p>
      {meta && <p className="settings-meta">{meta}</p>}
    </header>
  );
}

/**
 * A card with an optional icon, title, muted "last updated" line, short description and
 * header actions.
 */
export function SettingsSection({
  title,
  icon,
  meta,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card settings-section${className ? ` ${className}` : ''}`}>
      {title && (
        <div className="settings-section-head">
          {icon && <span className="settings-section-icon">{icon}</span>}
          <div className="settings-section-title">
            <h3>{title}</h3>
            {meta && <p className="settings-meta">{meta}</p>}
          </div>
          {actions && <div className="settings-section-actions">{actions}</div>}
        </div>
      )}
      {description && <p className="muted small settings-section-desc">{description}</p>}
      {children}
    </section>
  );
}

/** "• was ₱40.50" under a field whose value differs from the saved one. */
export function ChangedFieldHint({ was }: { was: string }) {
  return (
    <span className="was-hint">
      <span className="was-dot" aria-hidden="true" />
      was {was}
    </span>
  );
}

/** The one note line under a field: the error, else "was …" when changed, else the hint. */
function FieldNote({ id, error, changed, was, hint }: { id: string; error?: string; changed: boolean; was: string; hint?: ReactNode }) {
  const note = error ? (
    <span className="field-error">{error}</span>
  ) : changed ? (
    <ChangedFieldHint was={was} />
  ) : hint ? (
    <span className="hint">{hint}</span>
  ) : null;
  return (
    <span className="settings-field-note" id={id}>
      {note}
    </span>
  );
}

/**
 * A text input with an optional prefix/suffix inside the box. Shows the error, else the
 * "was …" hint when changed, else the hint. Changed fields get a gold left border.
 */
export function SettingsField({
  id,
  label,
  value,
  onChange,
  onBlur,
  prefix,
  suffix,
  inputMode = 'decimal',
  type = 'text',
  placeholder,
  maxLength,
  changed,
  was,
  error,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  prefix?: string;
  suffix?: string;
  inputMode?: 'decimal' | 'numeric' | 'text' | 'tel';
  type?: 'text' | 'tel';
  placeholder?: string;
  maxLength?: number;
  changed: boolean;
  was: string;
  error?: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const noteId = `${id}-note`;
  return (
    <div className={`settings-field${changed ? ' is-changed' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`input-affix${error ? ' is-invalid' : ''}`}>
        {prefix && (
          <span className="affix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          disabled={disabled}
        />
        {suffix && (
          <span className="affix" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      <FieldNote id={noteId} error={error} changed={changed} was={was} hint={hint} />
    </div>
  );
}

/** An on/off switch with the same "was …" hint and gold border as SettingsField. */
export function SettingsSwitch({
  id,
  label,
  checked,
  onChange,
  changed,
  was,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  changed: boolean;
  was: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const noteId = `${id}-note`;
  return (
    <div className={`settings-field settings-switch-field${changed ? ' is-changed' : ''}`}>
      <label className="settings-switch-row" htmlFor={id}>
        <span>{label}</span>
        <span className="switch">
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={noteId}
            disabled={disabled}
          />
          <span className="switch-track" aria-hidden="true" />
        </span>
      </label>
      <FieldNote id={noteId} changed={changed} was={was} hint={hint} />
    </div>
  );
}

/**
 * Sticky bar at the bottom of the content area (or of its card). Hidden when nothing
 * changed, unless nothing is saved yet (then the defaults can be reviewed and saved). Errors
 * disable "Review & save" and link to the first invalid field.
 */
export function SaveBar({
  changeCount,
  notSavedYet = false,
  notSavedText = NOT_SAVED_YET_TEXT,
  errors,
  busy = false,
  onDiscard,
  onFix,
}: {
  changeCount: number;
  notSavedYet?: boolean;
  notSavedText?: string;
  errors: FieldError[];
  busy?: boolean;
  onDiscard: () => void;
  /** Shows the field first when it may be hidden (e.g. by a search); default: focus it. */
  onFix?: (id: string) => void;
}) {
  if (changeCount === 0 && !notSavedYet) return null;
  const firstError = errors[0];
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-status">
        {changeCount > 0 ? <strong>{unsavedChangesLabel(changeCount)}</strong> : <span>{notSavedText}</span>}
        {firstError && (
          <button
            type="button"
            className="btn-link save-bar-error"
            onClick={() => (onFix ? onFix(firstError.id) : document.getElementById(firstError.id)?.focus())}
          >
            Fix {errors.length === 1 ? '' : `${errors.length} fields, starting with `}
            {firstError.label}
          </button>
        )}
      </div>
      <div className="save-bar-actions">
        {changeCount > 0 && (
          <button type="button" className="btn-outline" onClick={onDiscard} disabled={busy}>
            Discard
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy || errors.length > 0}>
          Review &amp; save
        </button>
      </div>
    </div>
  );
}

/** "Setting · Old · New" for every changed value, when it takes effect, and warnings. */
export function ReviewChangesDialog({
  rows,
  effectNote,
  extraNote,
  saving,
  error,
  onBack,
  onSave,
}: {
  rows: ChangeRow[];
  effectNote: string;
  extraNote?: ReactNode;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <ConfirmDialog
      title="Review changes"
      confirmLabel="Save changes"
      cancelLabel="Back"
      busy={saving}
      onConfirm={onSave}
      onCancel={onBack}
    >
      <div className="table-scroll review-scroll">
        <table className="change-table review-table">
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col">Old</th>
              <th scope="col">New</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.warning ? 'warn' : undefined}>
                <td>
                  {row.label}
                  {row.warning && (
                    <span className="review-warning">
                      <span aria-hidden="true">⚠ </span>
                      {changeWarningText(row.warning)}
                    </span>
                  )}
                </td>
                <td className="review-old">{row.oldText}</td>
                <td className="review-new">{row.newText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{effectNote}</p>
      {extraNote}
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}
    </ConfirmDialog>
  );
}

const TOAST_MS = 4000;

/** Small success message at the bottom right; disappears after a few seconds. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDone]);
  return (
    <div className="toast" role="status">
      <span className="toast-check" aria-hidden="true">
        ✓
      </span>
      {message}
    </div>
  );
}
