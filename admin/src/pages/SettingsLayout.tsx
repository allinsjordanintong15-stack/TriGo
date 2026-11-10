import { useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { PageTabs, type PageTab } from '../components/PageTabs';
import { BarangayTariffsPage } from './BarangayTariffsPage';
import { CommissionPage } from './CommissionPage';
import { FareSettingsPage } from './FareSettingsPage';
import { QuotaPage } from './QuotaPage';
import { SystemSettingsPage } from './SystemSettingsPage';

type SettingsTab = PageTab & { key: string; render: () => ReactNode };

const SETTINGS_TABS: SettingsTab[] = [
  { key: 'fares', to: '/settings/fares', label: 'Fares', render: () => <FareSettingsPage /> },
  { key: 'tariffs', to: '/settings/tariffs', label: 'Barangay tariffs', render: () => <BarangayTariffsPage /> },
  { key: 'commission', to: '/settings/commission', label: 'Commission', render: () => <CommissionPage /> },
  { key: 'quota', to: '/settings/quota', label: 'Quota', render: () => <QuotaPage /> },
  { key: 'system', to: '/settings/system', label: 'System', render: () => <SystemSettingsPage /> },
];

export const DEFAULT_SETTINGS_TAB = '/settings/fares';

/**
 * Settings (/settings/:tab). A tab's page mounts the first time it is opened and then stays
 * mounted (hidden) while other tabs are shown, so unsaved form values survive tab switches.
 * Nothing is loaded for a tab until it is opened. Leaving Settings unmounts them all.
 */
export function SettingsLayout() {
  const { tab } = useParams();
  const current = SETTINGS_TABS.find((t) => t.key === tab);
  const [opened, setOpened] = useState<string[]>(() => (current ? [current.key] : []));

  if (current && !opened.includes(current.key)) {
    // Adjusting state while rendering (React's documented pattern): mount the newly opened tab.
    setOpened([...opened, current.key]);
  }

  if (!current) return <Navigate to={DEFAULT_SETTINGS_TAB} replace />;

  return (
    <div className="stack">
      <PageTabs label="Settings" tabs={SETTINGS_TABS} />
      {SETTINGS_TABS.filter((t) => t.key === current.key || opened.includes(t.key)).map((t) => (
        <div key={t.key} hidden={t.key !== current.key}>
          {t.render()}
        </div>
      ))}
    </div>
  );
}
