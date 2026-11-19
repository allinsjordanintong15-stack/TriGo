import { addRemarkChip } from '../inbox/noticePlan';

type RemarkChipsProps = {
  /** Accessible name of the group, e.g. "Common remarks". */
  label: string;
  chips: readonly string[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

/**
 * Quick-fill buttons above a reason field: each adds its text (on a new line when the field
 * already has text; never twice). The admin can still edit the result freely.
 */
export function RemarkChips({ label, chips, value, onChange, disabled }: RemarkChipsProps) {
  return (
    <div className="remark-chips" role="group" aria-label={label}>
      {chips.map((chip) => {
        const used = value.split('\n').some((line) => line.trim() === chip);
        return (
          <button
            key={chip}
            type="button"
            className="remark-chip"
            aria-pressed={used}
            disabled={disabled || used}
            onClick={() => onChange(addRemarkChip(value, chip))}
          >
            + {chip}
          </button>
        );
      })}
    </div>
  );
}
