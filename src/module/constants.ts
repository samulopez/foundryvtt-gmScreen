export const MODULE_ID = 'gm-screen';
export const MODULE_ABBREV = 'GMSCR';

export const TEMPLATES = {
  settings: `modules/${MODULE_ID}/templates/settings.hbs`,
  screen: `modules/${MODULE_ID}/templates/screen.hbs`,
  screenContent: `modules/${MODULE_ID}/templates/parts/screen-content.hbs`,
  screenTabs: `modules/${MODULE_ID}/templates/parts/screen-tabs.hbs`,
  screenCell: `modules/${MODULE_ID}/templates/parts/screen-cell.hbs`,
  screenGrid: `modules/${MODULE_ID}/templates/parts/screen-grid.hbs`,
  grids: {
    tableRow: `modules/${MODULE_ID}/templates/parts/settings-grid-config-table-row.hbs`,
  },
};

export enum MySettings {
  columns = 'columns',
  displayDrawer = 'display-as-drawer',
  drawerHeight = 'drawer-height',
  drawerOpacity = 'drawer-opacity',
  drawerWidth = 'drawer-width',
  gmScreenConfig = 'gm-screen-config',
  migrated = 'migrated',
  condensedButton = 'condensedButton',
  reset = 'reset',
  rightMargin = 'right-margin',
  rows = 'rows',
}

export enum MyFlags {}

export const numberRegex = /([+-]?(?=\.\d|\d)(?:\d+)?(?:\.?\d*))(?:[eE]([+-]?\d+))?/;
