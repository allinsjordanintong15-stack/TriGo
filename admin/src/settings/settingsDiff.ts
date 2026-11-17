// Change detection for the Settings tabs' edit flow: which fields differ from the saved
// values, the "Setting · Old · New" rows of the review dialog and the gold warnings.
// No imports (tested by tests/admin/settingsDiff.test.ts under plain Node).

/** A value changing by more than this share of the old value gets a warning. */
export const LARGE_CHANGE_RATIO = 0.5;

export type ChangeWarning = 'zero' | 'large';

/**
 * Warning for a number going from `oldValue` to `newValue`: 'zero' when it is set to 0,
 * 'large' when it changes by more than 50% (any change away from 0 counts as large).
 * None for first-time values (`oldValue` null) or when nothing changes.
 */
export function changeWarning(oldValue: number | null, newValue: number): ChangeWarning | null {
  if (oldValue === null || oldValue === newValue) return null;
  if (newValue === 0) return 'zero';
  if (oldValue === 0) return 'large';
  return Math.abs(newValue - oldValue) / Math.abs(oldValue) > LARGE_CHANGE_RATIO ? 'large' : null;
}

export function changeWarningText(warning: ChangeWarning): string {
  return warning === 'zero' ? 'Set to 0' : 'Changes by more than 50%';
}

export type Parsed<V> = { value: V } | { error: string };

/** One editable number field of a settings form. */
export type NumberField = {
  /** Unique key; also the input's id, so errors can point to it. */
  id: string;
  label: string;
  /** The admin's text in the input. */
  text: string;
  /** The text the field started with (the saved value, or the default when nothing is saved). */
  initialText: string;
  /** The value the field started with. */
  initial: number;
  parsed: Parsed<number>;
  format: (value: number) => string;
};

export type FieldError = { id: string; label: string; message: string };

export type ChangeRow = {
  id: string;
  label: string;
  oldText: string;
  newText: string;
  warning: ChangeWarning | null;
};

/** True when the field no longer matches what it started with (invalid text counts as a change). */
export function isFieldChanged(field: NumberField): boolean {
  if ('value' in field.parsed) return field.parsed.value !== field.initial;
  return field.text.trim() !== field.initialText.trim();
}

export type FormDiff = {
  /** Ids of the fields that differ from their initial value. */
  changedIds: string[];
  /** Fields whose text does not parse, in form order. */
  errors: FieldError[];
  /** Review rows: every changed field, or every field when nothing is saved yet. */
  rows: ChangeRow[];
};

/**
 * Compares a form's fields with their initial values. `notSavedYet` means the initial
 * values are built-in defaults: the review then lists every field (Old = the default, with
 * no warnings), so the defaults can be saved unchanged.
 */
export function diffNumberFields(fields: NumberField[], options: { notSavedYet: boolean }): FormDiff {
  const changedIds: string[] = [];
  const errors: FieldError[] = [];
  const rows: ChangeRow[] = [];
  for (const field of fields) {
    const changed = isFieldChanged(field);
    if (changed) changedIds.push(field.id);
    if ('error' in field.parsed) {
      errors.push({ id: field.id, label: field.label, message: field.parsed.error });
      continue;
    }
    if (!changed && !options.notSavedYet) continue;
    rows.push({
      id: field.id,
      label: field.label,
      oldText: options.notSavedYet ? `${field.format(field.initial)} (default)` : field.format(field.initial),
      newText: field.format(field.parsed.value),
      warning: options.notSavedYet ? null : changeWarning(field.initial, field.parsed.value),
    });
  }
  return { changedIds, errors, rows };
}

/** "1 unsaved change" / "3 unsaved changes". */
export function unsavedChangesLabel(count: number): string {
  return `${count} unsaved change${count === 1 ? '' : 's'}`;
}
