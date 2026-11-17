import type { ReactNode } from 'react';

import type { VehicleType } from '../../fares/fareSettings';

// Small line icons for the vehicle cards, drawn in currentColor like the sidebar icons.

const PATHS: Record<VehicleType, ReactNode> = {
  // Motorcycle with a covered sidecar.
  tricycle: (
    <>
      <circle cx="5" cy="17" r="2.5" />
      <circle cx="19" cy="17" r="2.5" />
      <path d="M7.5 17h9M5 14.5l3-5h4l2 5" />
      <path d="M14 9.5V6h6v7.5" />
      <path d="M13 6h8" />
    </>
  ),
  motorcycle: (
    <>
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M5 17l4-7h5l5 7" />
      <path d="M14 10l-1.5-3H10M9 13h6" />
    </>
  ),
};

export function VehicleIcon({ type }: { type: VehicleType }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[type]}
    </svg>
  );
}
