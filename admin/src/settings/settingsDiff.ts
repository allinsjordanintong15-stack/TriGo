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

export type SettingValue = number | string | boolean;

export type Parsed<V> = { value: V } | { error: string };

/** One editable value of a settings form (a text input, a switch, a table cell). */
export type SettingField = {
  /** Unique key; also the input's id, so errors can point to it. */
  id: string;
  label: string;
  /** The admin's text in the input (for a switch, "true"/"false"). */
  text: string;
  /** The text the field started with ('' when nothing is saved for it). */
  initialText: string;
  /**
   * The value the field started with: the saved value, the built-in default when the form
   * has `notSavedYet`, or null when nothing is saved for it ("Not set", first-time value).
   */
  initial: SettingValue | null;
  /** The parsed text (a normalized value, so "8" equals 8.00 and "0917 123 4567" its digits). */
  parsed: Parsed<SettingValue>;
  format: (value: SettingValue) => string;
};

export type FieldError = { id: string; label: string; message: string };

export type ChangeRow = {
  id: string;
  label: string;
  oldText: string;
  newText: string;
  warning: ChangeWarning | null;
};

export const NOT_SET_TEXT = 'Not set';

/** True when the field no longer matches what it started with (invalid text counts as a change). */
export function isFieldChanged(field: SettingField): boolean {
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
 * no warnings), so the defaults can be saved unchanged. Fields with no initial value are
 * first-time values: Old is "Not set" and they get no warning.
 */
export function diffFields(fields: SettingField[], options: { notSavedYet?: boolean } = {}): FormDiff {
  const notSavedYet = options.notSavedYet ?? false;
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
    if (!changed && !notSavedYet) continue;
    const { initial } = field;
    const newValue = field.parsed.value;
    let oldText = initial === null ? NOT_SET_TEXT : field.format(initial);
    if (notSavedYet && initial !== null) oldText = `${oldText} (default)`;
    rows.push({
      id: field.id,
      label: field.label,
      oldText,
      newText: field.format(newValue),
      warning:
        !notSavedYet && typeof initial === 'number' && typeof newValue === 'number'
          ? changeWarning(initial, newValue)
          : null,
    });
  }
  return { changedIds, errors, rows };
}

/** "1 unsaved change" / "3 unsaved changes". */
export function unsavedChangesLabel(count: number): string {
  return `${count} unsaved change${count === 1 ? '' : 's'}`;
}

/** A switch as a field: its text is "true"/"false", so it always parses. */
export function switchField(
  base: Omit<SettingField, 'text' | 'initialText' | 'parsed' | 'format'>,
  checked: boolean,
  labels: [on: string, off: string],
): SettingField {
  return {
    ...base,
    text: String(checked),
    initialText: base.initial === null ? '' : String(base.initial),
    parsed: { value: checked },
    format: (value) => (value ? labels[0] : labels[1]),
  };
}
