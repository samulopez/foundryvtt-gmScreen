import { GmScreenConfig, GmScreenGrid, GmScreenGridEntry } from '../gridTypes';

import { getGame, log } from './helpers';
import { MODULE_ID, MySettings } from './constants';

interface GmScreenConfig1 {
  grid: {
    entries: GmScreenGridEntry[];
  };
}

export async function gmScreenMigrate() {
  if (!getGame().user?.isGM) return;
  const NEEDS_MIGRATION_VERSION = '2.0.1';
  // Updating from old install -> Migrated
  // Fresh install -> No migration CHECK
  // Skipped multiple versions and upgrading in 0.4.X or higher
  // X round of migrations (bound to happen again, right?)
  const migrated = getGame().settings.get(MODULE_ID, MySettings.migrated);
  // If we have migrated before
  if (migrated.status) {
    // If our version is newer than the NEEDS_MIGRATION_VERSION
    if (foundry.utils.isNewerVersion(getGame().modules.get(MODULE_ID)?.version ?? '0', NEEDS_MIGRATION_VERSION)) return;
    // If we are on the same version, but have migrated.
    if (migrated.version === NEEDS_MIGRATION_VERSION) return;
  }

  ui.notifications?.notify('GM Screen | Beginning Migration to updated schema.', 'info');

  const gmScreenConfig = getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig) as unknown as GmScreenConfig1;
  if (!!gmScreenConfig?.grid?.entries && Array.isArray(gmScreenConfig.grid.entries)) {
    // need to convert gmscreenconfig.grid.entries from array to object

    const migratedEntries: GmScreenGrid['entries'] = gmScreenConfig.grid.entries.reduce((acc, entry) => {
      const entryId = `${entry.x}-${entry.y}`;

      acc[entryId] = {
        ...entry,
        entryId,
      };

      return acc;
    }, {});

    const output: GmScreenConfig = {
      activeGridId: 'default',
      grids: {
        default: {
          ...gmScreenConfig.grid,
          entries: migratedEntries,
          id: 'default',
          name: 'Main',
          isShared: false,
          cssClass: 'active',
        },
      },
    };

    log(true, 'migration output', {
      output,
    });

    await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, output);
  }

  ui.notifications?.notify('GM Screen | Migration Complete.', 'info');

  await getGame().settings.set(MODULE_ID, MySettings.migrated, { status: true, version: NEEDS_MIGRATION_VERSION });
}
