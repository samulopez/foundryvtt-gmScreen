import { gmScreenMigrate } from './module/migration';
import { getGame, getLocalization, getUserViewableGrids, log } from './module/helpers';
import { MODULE_ABBREV, MODULE_ID, MySettings, TEMPLATES } from './module/constants';
import { GmScreenSettings } from './module/classes/GmScreenSettings';
import { GmScreenApplication } from './module/classes/GmScreenApplication';
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

/*
 * https://stackoverflow.com/questions/53398408/switch-case-with-default-in-handlebars-js
 * {{#switch 'a'}}
 *   {{#case 'a'}} A {{/case}}
 *   {{#case 'b'}} B {{/case}}
 * {{/switch}}
 */
Handlebars.registerHelper(`${MODULE_ABBREV}-switch`, function helperSwitch(value, options) {
  this.switch_value = value;
  return options.fn(this);
});

Handlebars.registerHelper(`${MODULE_ABBREV}-case`, function helperCase(value, options) {
  if (value === this.switch_value) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper(`${MODULE_ABBREV}-enrich`, (str) =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(str)
);

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async () => {
  log(true, `Initializing ${MODULE_ID}`);

  // Register custom module settings
  GmScreenSettings.init();

  // Preload Handlebars templates
  await foundry.applications.handlebars.loadTemplates(Object.values(foundry.utils.flattenObject(TEMPLATES)));
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', async () => {
  await gmScreenMigrate();

  window[MODULE_ID] = { migration: gmScreenMigrate };

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
      refreshGmScreen,
    } as GmScreenApi;
  }

  if (getGame().user?.isGM) {
    getGame().settings.set(MODULE_ID, MySettings.reset, false);
  }
});

function addGmScreenButton(html) {
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

Hooks.on('renderJournalDirectory', (_app, html) => {
  const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

  if (!displayDrawer) {
    addGmScreenButton(html);
  }
});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});
