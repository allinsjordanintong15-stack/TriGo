import {
  MAX_VEHICLE_BRAND_LENGTH,
  MAX_VEHICLE_COLOR_LENGTH,
  MAX_VEHICLE_MODEL_LENGTH,
  VEHICLE_COLORS,
  type VehicleDetailErrors,
  type VehicleDetails,
} from '../drivers/driverRecords';

type Props = {
  /** Prefix for the input ids, so two forms on a page do not clash. */
  idPrefix: string;
  value: VehicleDetails;
  onChange: (value: VehicleDetails) => void;
  errors: VehicleDetailErrors;
  /** Errors show only after the admin edits or tries to save. */
  showErrors: boolean;
  disabled: boolean;
};

const FIELDS: { key: keyof VehicleDetails; label: string; maxLength: number; placeholder: string }[] = [
  { key: 'vehicleBrand', label: 'Brand', maxLength: MAX_VEHICLE_BRAND_LENGTH, placeholder: 'e.g. Honda' },
  { key: 'vehicleModel', label: 'Model', maxLength: MAX_VEHICLE_MODEL_LENGTH, placeholder: 'e.g. TMX 155' },
  { key: 'vehicleColor', label: 'Color', maxLength: MAX_VEHICLE_COLOR_LENGTH, placeholder: 'e.g. Red or Blue/White' },
];

/** Brand, model and color inputs; color suggests the app's chip colors but accepts any valid color. */
export function VehicleDetailsFields({ idPrefix, value, onChange, errors, showErrors, disabled }: Props) {
  const colorListId = `${idPrefix}-colors`;
  return (
    <>
      {FIELDS.map(({ key, label, maxLength, placeholder }) => {
        const id = `${idPrefix}-${key}`;
        const error = showErrors ? errors[key] : null;
        return (
          <label key={key} className="field" htmlFor={id}>
            <span>{label}</span>
            <input
              id={id}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              maxLength={maxLength}
              placeholder={placeholder}
              list={key === 'vehicleColor' ? colorListId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              disabled={disabled}
            />
            {error && (
              <span className="hint">
                <span className="field-error">{error}</span>
              </span>
            )}
          </label>
        );
      })}
      <datalist id={colorListId}>
        {VEHICLE_COLORS.map((color) => (
          <option key={color} value={color} />
        ))}
      </datalist>
    </>
  );
}
