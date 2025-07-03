// Import TypeScript modules
import { MODULE_ABBREV, MODULE_ID, MyHooks, MySettings, TEMPLATES } from './module/constants';
import { GmScreenSettings } from './module/classes/GmScreenSettings';
import { getGame, getLocalization, getUserViewableGrids, log } from './module/helpers';
import { GmScreenApplication } from './module/classes/GmScreenApplication';
import { _gmScreenMigrate } from './module/migration';
import { GmScreenApi } from './gridTypes';
import './foundryvtt-gmScreen.scss';

let gmScreenInstance: GmScreenApplication;

async function toggleGmScreenOpen(isOpen?: boolean) {
  const gmScreenConfig = getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig);

  const userViewableGrids = getUserViewableGrids(gmScreenConfig);
  if (!Object.keys(userViewableGrids).length) {
    ui.notifications?.notify(getLocalization().localize(`${MODULE_ABBREV}.warnings.noGrids`), 'error');
    return;
  }

  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);
  if (displayDrawer && !!gmScreenInstance) {
    gmScreenInstance.toggleGmScreenVisibility(isOpen);
    return;
  }

  if (!gmScreenInstance) {
    gmScreenInstance = new GmScreenApplication();
  }

  const shouldOpen = isOpen ?? gmScreenInstance.state < 1;
  const shouldRender = gmScreenInstance.state < 1;

  try {
    if (shouldOpen) {
      if (shouldRender) {
        await gmScreenInstance.render(true);
      }
      if (gmScreenInstance.minimized) {
        gmScreenInstance.maximize();
      }
      gmScreenInstance.bringToFront();
    } else {
      gmScreenInstance.close();
    }
  } catch (error) {
    log(false, 'error occurred trying to toggle the GM screen', error);
  }
}

function refreshGmScreen() {
  if (gmScreenInstance) {
    gmScreenInstance.refresh();
  }
}

Handlebars.registerHelper(`${MODULE_ABBREV}-path`, (relativePath: string) => {
  return `modules/${MODULE_ID}/${relativePath}`;
});

/*
 * https://stackoverflow.com/questions/53398408/switch-case-with-default-in-handlebars-js
 * {{#switch 'a'}}
 *   {{#case 'a'}} A {{/case}}
 *   {{#case 'b'}} B {{/case}}
 * {{/switch}}
 */
Handlebars.registerHelper(`${MODULE_ABBREV}-switch`, function (value, options) {
  this.switch_value = value;
  return options.fn(this);
});

Handlebars.registerHelper(`${MODULE_ABBREV}-case`, function (value, options) {
  if (value == this.switch_value) {
    return options.fn(this);
  }
});

Handlebars.registerHelper(`${MODULE_ABBREV}-enrich`, function (str) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(str);
});

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
  log(true, `Initializing ${MODULE_ID}`);

  // Register custom module settings
  GmScreenSettings.init();

  // Preload Handlebars templates
  await foundry.applications.handlebars.loadTemplates(Object.values(foundry.utils.flattenObject(TEMPLATES)));
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', async function () {
  await _gmScreenMigrate();

  window[MODULE_ID] = { migration: _gmScreenMigrate };

  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

  // Do anything once the module is ready
  if (displayDrawer) {
    gmScreenInstance = new GmScreenApplication();
    gmScreenInstance.render(true);
  }

  const gmScreenModuleData = getGame().modules.get(MODULE_ID);

  if (gmScreenModuleData) {
    gmScreenModuleData.api = {
      toggleGmScreenVisibility: toggleGmScreenOpen,
      refreshGmScreen: refreshGmScreen,
    } as GmScreenApi;
  }

  window[MODULE_ID] = {
    toggleGmScreenVisibility: (...args) => {
      console.warn(
        MODULE_ID,
        'Deprecation Warning:',
        'window["gm-screen"]?.toggleGmScreenVisibility is deprecated in favor of getGame().modules.get("gm-screen")?.api?.toggleGmScreenVisibility and will be removed in a future update.'
      );

      gmScreenModuleData?.api?.toggleGmScreenVisibility(...args);
    },
    refreshGmScreen: (...args) => {
      console.warn(
        MODULE_ID,
        'Deprecation Warning:',
        'window["gm-screen"]?.refreshGmScreen is deprecated in favor of getGame().modules.get("gm-screen")?.api?.refreshGmScreen and will be removed in a future update.'
      );

      gmScreenModuleData?.api?.refreshGmScreen(...args);
    },
  };

  if (getGame().user?.isGM) {
    getGame().settings.set(MODULE_ID, MySettings.reset, false);
  }

  //@ts-expect-error
  Hooks.callAll(MyHooks.ready);
});

function _addGmScreenButton(html) {
  const jHTML = $(html);
  const actionButtons = jHTML.find('.header-actions');

  const gmScreenButtonHtml = `<button class="gm-screen-button">
          <i class="fas fa-book-reader"></i> ${getLocalization().localize(`${MODULE_ABBREV}.gmScreen.Open`)}
      </button>`;

  actionButtons.append(gmScreenButtonHtml);

  const gmScreenButton = jHTML.find('button.gm-screen-button');

  gmScreenButton.on('click', (event) => {
    event.preventDefault();
    toggleGmScreenOpen(true);
  });
}

Hooks.on('renderJournalDirectory', (app, html, data) => {
  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

  if (!displayDrawer) {
    _addGmScreenButton(html);
  }
});

// when gm screen in non-drawer mode is closed call MyHooks.openClose with isOpen: false
//@ts-expect-error
Hooks.on('closeGmScreenApplication', (app, html, data) => {
  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

  if (!displayDrawer) {
    //@ts-expect-error
    Hooks.callAll(MyHooks.openClose, app, { isOpen: false });
  }
});

// when gm screen in non-drawer mode is opened call MyHooks.openClose with isOpen: true
//@ts-expect-error
Hooks.on('renderGmScreenApplication', (app, html, data) => {
  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

  if (!displayDrawer) {
    //@ts-expect-error
    Hooks.callAll(MyHooks.openClose, app, { isOpen: true });
  }
});

//@ts-expect-error
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});
