// Commission display settings for the driver app. No imports, so plain Node tests can load
// this file.

/**
 * Driver Home shows the gold "Commission due" banner only when this many hours or fewer
 * are left before the running period's due time. Before that, the "Commission owed" tile
 * shows the balance. Overdue and suspended banners do not depend on this.
 */
export const COMMISSION_DUE_SOON_HOURS = 24;
