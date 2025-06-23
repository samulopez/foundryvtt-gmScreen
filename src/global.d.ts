import { GmScreenConfig } from './gridTypes';

declare global {
  interface ModuleConfig {
    'gm-screen': {
      api?: Record<string, any>;
    };
    'gm-screen_dev-mode': {
      api?: Record<string, any>;
    };
    '_dev-mode': {
      api?: Record<string, any>;
    };
  }
  interface SettingConfig {
    'gm-screen.columns': number;
    'gm-screen.display-as-drawer': boolean;
    'gm-screen.drawer-height': number;
    'gm-screen.drawer-opacity': number;
    'gm-screen.drawer-width': number;
    'gm-screen.gm-screen-config': GmScreenConfig;
    'gm-screen.migrated': {
      status: boolean;
      version: string;
    };
    'gm-screen.condensedButton': boolean;
    'gm-screen.reset': boolean;
    'gm-screen.right-margin': number;
    'gm-screen.rows': number;
  }
}
