import { RowActionsMenu } from '../components/RowActionsMenu';
import type { DriverAction } from './DriverActionDialog';

/**
 * The "⋯" button of a driver row: Send warning, and Suspend or Lift suspension. (Revoke and
 * restore are on the driver's profile page.)
 */
export function DriverActionsMenu({
  name,
  suspended,
  onAction,
}: {
  name: string;
  suspended: boolean;
  onAction: (action: DriverAction) => void;
}) {
  return (
    <RowActionsMenu
      name={name}
      items={[
        { label: 'Send warning', onSelect: () => onAction('warning') },
        suspended
          ? { label: 'Lift suspension', onSelect: () => onAction('lift') }
          : { label: 'Suspend', onSelect: () => onAction('suspend'), danger: true },
      ]}
    />
  );
}
