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

/** Page title, one helper sentence and "Last updated <date, time> by you / another admin". */
export function SettingsHeader({
  title,
  helper,
  updatedAt,
  updatedBy,
  notSavedYet = false,
}: {
  title: string;
  helper: ReactNode;
  updatedAt: Date | null;
  updatedBy: string | null;
  notSavedYet?: boolean;
}) {
  const { admin } = useAuth();
  let meta: string;
  if (notSavedYet) {
    meta = `${NOT_SAVED_YET_TEXT}.`;
  } else {
    const by = updatedBy ? (updatedBy === admin?.uid ? ' by you' : ' by another admin') : '';
    meta = `Last updated ${updatedAt ? formatDateTime(updatedAt) : 'at an unknown time'}${by}`;
  }
  return (
    <header className="settings-header">
      <h2 className="page-title">{title}</h2>
      <p className="settings-helper">{helper}</p>
      <p className="settings-meta">{meta}</p>
    </header>
  );
}

/** A card with an optional icon, title and short description. */
export function SettingsSection({
  title,
  icon,
  description,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card settings-section${className ? ` ${className}` : ''}`}>
      {title && (
        <div className="settings-section-head">
          {icon && <span className="settings-section-icon">{icon}</span>}
          <h3>{title}</h3>
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
  changed: boolean;
  was: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const noteId = `${id}-note`;
  const note = error ? (
    <span className="field-error">{error}</span>
  ) : changed ? (
    <ChangedFieldHint was={was} />
  ) : hint ? (
    <span className="hint">{hint}</span>
  ) : null;
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
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          disabled={disabled}
        />
        {suffix && (
          <span className="affix" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      <span className="settings-field-note" id={noteId}>
        {note}
      </span>
    </div>
  );
}

/**
 * Sticky bar at the bottom of the content area. Hidden when nothing changed, unless nothing
 * is saved yet (then the defaults can be reviewed and saved). Errors disable "Review & save"
 * and link to the first invalid field.
 */
export function SaveBar({
  changeCount,
  notSavedYet = false,
  errors,
  busy = false,
  onDiscard,
}: {
  changeCount: number;
  notSavedYet?: boolean;
  errors: FieldError[];
  busy?: boolean;
  onDiscard: () => void;
}) {
  if (changeCount === 0 && !notSavedYet) return null;
  const firstError = errors[0];
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-status">
        {changeCount > 0 ? (
          <strong>{unsavedChangesLabel(changeCount)}</strong>
        ) : (
          <span>{NOT_SAVED_YET_TEXT}</span>
        )}
        {firstError && (
          <button
            type="button"
            className="btn-link save-bar-error"
            onClick={() => document.getElementById(firstError.id)?.focus()}
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
