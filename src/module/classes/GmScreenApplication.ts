import {
  emptyClose,
  getGame,
  getGridElementsPosition,
  getLocalization,
  getUserCellConfigurationInput,
  getUserViewableGrids,
  isActorOrItemResizable,
  log,
  postRenderV2,
  updateCSSPropertyVariable,
} from '../helpers';
import { MODULE_ABBREV, MODULE_ID, MySettings, TAB_GROUP_NAME, TEMPLATES } from '../constants';
import { GmScreenConfig, GmScreenGrid, GmScreenGridEntry } from '../../gridTypes';

import { GmScreenSettings } from './GmScreenSettings';
import { CompactRollTableDisplay } from './CompactRollTableDisplay';
import { CompactJournalEntryPageDisplay } from './CompactJournalEntryPageDisplay';
import { CompactJournalEntryDisplay } from './CompactJournalEntryDisplay';

enum ClickAction {
  clearGrid = 'clearGrid',
  refresh = 'refresh',
  clearCell = 'clearCell',
  configureCell = 'configureCell',
  open = 'open',
  statBlock = 'statBlock',
  toggleGmScreen = 'toggle-gm-screen',
  tab = 'tab',
}

interface CustomOptions {
  cellId: string;
  _injectHTML(html: JQuery): void;
  _replaceHTML(element: JQuery, html: JQuery): void;
  _postRender(): Promise<void>;
}

type GmScreenApp =
  | (ActorSheet & { render: (force?: boolean) => void })
  | (ItemSheet & { render: (force?: boolean) => void })
  | (foundry.applications.sheets.journal.JournalEntrySheet & { render: (force?: boolean) => void })
  | (foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet & { render: (force?: boolean) => void })
  | (foundry.applications.sheets.RollTableSheet & { render: (force?: boolean) => void })
  | (foundry.applications.sheets.ActorSheetV2 & { render: (force?: boolean) => void })
  | (foundry.applications.sheets.ItemSheetV2 & { render: (force?: boolean) => void });

type ActorV2Constructor = new (
  options: Partial<foundry.applications.sheets.ActorSheetV2.Configuration>
) => foundry.applications.sheets.ActorSheetV2 & CustomOptions;

type JournalEntryPageProseMirrorSheetConstructor = new (
  options: Partial<foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet.Configuration>
) => foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet & CustomOptions;

type ItemV2Constructor = new (
  options: Partial<foundry.applications.sheets.ItemSheetV2>
) => foundry.applications.sheets.ItemSheetV2 & CustomOptions;

type ItemAndActorV1Constructor = new (
  x: Actor | Item,
  options: {
    width?: string;
    height?: string;
    positioned?: boolean;
    resizable?: boolean;
  }
) => (ItemSheet & CustomOptions) | (ActorSheet & CustomOptions);

export class GmScreenApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  expanded: boolean;

  data: GmScreenConfig;

  apps: Record<string, GmScreenApp>;

  // used to allow players to switch tabs
  currentTab: string;

  draggedTab: HTMLElement | undefined;

  constructor(options = {}) {
    super(options);
    this.expanded = false;
    this.data = getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig);
    this.apps = {};
    this.currentTab = this.data.activeGridId;

    const columns = getGame().settings.get(MODULE_ID, MySettings.columns);
    const rows = getGame().settings.get(MODULE_ID, MySettings.rows);
    const displayDrawer = getGame().settings.get(MODULE_ID, MySettings.displayDrawer);

    const drawerOptions = {
      window: {
        ...this.options.window,
        resizable: false,
        frame: false,
      },
    };

    const gmButtons = [
      {
        action: ClickAction.clearGrid,
        label: getLocalization().localize(`${MODULE_ABBREV}.gmScreen.Reset`),
        class: 'clear',
        icon: 'fas fa-ban',
        onClick: () => this.handleClear.bind(this)(),
      },
    ];

    const popOutOptions = {
      classes: ['window-app', 'gm-screen-popOut'],
      width: Number(columns) * 400,
      height: Number(rows) * 300,
      window: {
        ...this.options.window,
        resizable: true,
        frame: true,
        controls: [
          {
            action: ClickAction.refresh,
            label: getLocalization().localize(`${MODULE_ABBREV}.gmScreen.Refresh`),
            class: 'refresh',
            icon: 'fas fa-sync',
            onClick: () => this.refresh(),
          },
          ...(getGame().user?.isGM ? gmButtons : []),
        ],
      },
    };

    log(false, {
      displayDrawer,
      options: displayDrawer ? drawerOptions : popOutOptions,
    });

    this.options = {
      ...this.options,
      ...(displayDrawer ? drawerOptions : popOutOptions),
    };
  }

  static PARTS = {
    tabs: {
      template: TEMPLATES.screenTabs,
    },
    content: {
      template: TEMPLATES.screenContent,
    },
  };

  static DEFAULT_OPTIONS = {
    id: 'gm-screen-app',
  };

  get rows() {
    return getGame().settings.get(MODULE_ID, MySettings.rows);
  }

  get columns() {
    return getGame().settings.get(MODULE_ID, MySettings.columns);
  }

  get displayDrawer() {
    return getGame().settings.get(MODULE_ID, MySettings.displayDrawer);
  }

  get userViewableGrids() {
    return getUserViewableGrids(this.data);
  }

  get hasUserViewableGrids() {
    return !!Object.keys(this.userViewableGrids).length;
  }

  get title() {
    return !this.displayDrawer ? getLocalization().localize(`${MODULE_ABBREV}.gmScreen.Title`) : '';
  }

  get activeGrid() {
    return this.data.grids[this.data.activeGridId];
  }

  static getNumOccupiedCells(grid: GmScreenGrid) {
    return Object.values(grid.entries).reduce((acc, entry) => {
      const cellsTaken = (entry.spanCols || 1) * (entry.spanRows || 1);
      return acc + cellsTaken;
    }, 0);
  }

  /**
   * Helper function to update the gmScreenConfig setting with a new grid's worth of data
   * @param {GmScreenGrid} newGridData - the complete grid object to set
   */
  async setGridData(newGridData: GmScreenGrid) {
    const newGmScreenConfig = foundry.utils.deepClone(this.data);

    const updated = foundry.utils.setProperty(newGmScreenConfig, `grids.${newGridData.id}`, newGridData);

    if (!updated) {
      // something failed
      log(true, 'error occurred trying to set a grid data');
      return;
    }

    // changing this setting will auto-refresh the screen
    await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, newGmScreenConfig);
  }

  /**
   * Adds an Entry to the proper place on the active grid's data.
   * Replaces an existing entry if the entryId matches
   * @param {GmScreenGridEntry} newEntry The Entry being added.
   */
  async addEntryToActiveGrid(newEntry: GmScreenGridEntry) {
    const newEntries = { ...this.activeGrid.entries };

    newEntries[newEntry.entryId] = {
      ...newEntries[newEntry.entryId],
      ...newEntry,
    };

    const newGridData: GmScreenGrid = {
      ...this.activeGrid,
      entries: newEntries,
    };

    log(false, 'addEntryToActiveGrid', {
      activeGridData: this.activeGrid,
      newEntries,
      newEntry,
      newGridData,
    });

    this.setGridData(newGridData);
  }

  /**
   * Remove a given entry from the Active Grid
   * @param {string} entryId - entry to remove from the active grid's entries
   */
  async removeEntryFromActiveGrid(entryId: string, gridCellId?: string) {
    const clearedCell = foundry.utils.deepClone(this.activeGrid.entries[entryId]);
    const shouldKeepCellLayout = clearedCell.spanCols || clearedCell.spanRows;

    const newEntries = {
      ...this.activeGrid.entries,
    };

    if (shouldKeepCellLayout) {
      delete clearedCell.entityUuid;
      delete clearedCell.type;
      delete clearedCell.isDndNpc;
      delete clearedCell.isDndNpcStatBlock;
      newEntries[entryId] = clearedCell;
    } else {
      delete newEntries[entryId];
    }

    if (gridCellId) {
      const appKey = `#${gridCellId}`;
      await this.apps[appKey]?.close();
      delete this.apps[appKey];
    }

    const newGridData: GmScreenGrid = {
      ...this.activeGrid,
      entries: newEntries,
    };

    this.setGridData(newGridData);
  }

  bringToFront() {
    if (!this.displayDrawer) {
      super.bringToFront();
      return;
    }
    if (this.position.zIndex === foundry.applications.api.ApplicationV2._maxZ) {
      return;
    }

    foundry.applications.api.ApplicationV2._maxZ += 1;
    this.setPosition({
      zIndex: foundry.applications.api.ApplicationV2._maxZ,
    });
  }

  /**
   * Set the GM Screen Visibility. By default will toggle the current state.
   * @param {boolean} expanded
   */
  toggleGmScreenVisibility(expanded = !this.expanded) {
    this.expanded = expanded;

    if (this.expanded) {
      this.bringToFront();
      $('.gm-screen-app').addClass('expanded');
      $('.gm-screen-app').css('z-index', this.position.zIndex);
    } else {
      $('.gm-screen-app').removeClass('expanded');
    }
  }

  /**
   * Double confirms Clearing the Active Grid
   */
  async handleClear() {
    log(false, 'handleClear');

    const proceed = await foundry.applications.api.DialogV2.confirm({
      title: getLocalization().localize(`${MODULE_ABBREV}.warnings.clearConfirm.Title`),
      content: getLocalization().localize(`${MODULE_ABBREV}.warnings.clearConfirm.Content`),
    });

    if (proceed) {
      this.apps = {};
      this.setGridData({
        ...this.activeGrid,
        entries: {},
      });
    }
  }

  _dragStartTab(event: DragEvent) {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    this.draggedTab = event.target;
  }

  _dragOverTab(event: DragEvent) {
    if (!this.draggedTab || !(event.target instanceof HTMLElement)) {
      return;
    }

    const children = Array.from($(event.target).closest('.gm-screen-tabs').children());

    if (children.indexOf(event.target) > children.indexOf(this.draggedTab)) {
      event.target.after(this.draggedTab);
    } else {
      event.target.before(this.draggedTab);
    }
  }

  async _dragEndTab(event: DragEvent) {
    if (!this.draggedTab || !(event.target instanceof HTMLElement)) {
      return;
    }

    const newGmScreenConfig = foundry.utils.deepClone(this.data);
    newGmScreenConfig.grids = {};

    // rebuild gmScreenConfig based on the current layout of the tabs
    $(event.target)
      .closest('.gm-screen-tabs')
      .children()
      .each((index, item) => {
        const gridId = $(item).attr('data-tab');
        if (!gridId) {
          return;
        }
        newGmScreenConfig.grids[gridId] = this.data.grids[gridId];
      });

    this.draggedTab = undefined;
    await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, newGmScreenConfig);
  }

  async handleClickEvent(e: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    e.preventDefault();

    const action = e.currentTarget.dataset.action as ClickAction;
    const entityUuid = $(e.currentTarget).parents('[data-entity-uuid]')?.data()?.entityUuid;
    const entryId = $(e.currentTarget).parents('[data-entry-id]')?.data()?.entryId;
    const gridCellId = $(e.currentTarget).parents('[data-entry-id]')?.attr('id');

    log(false, 'handleClickEvent', {
      e,
      action,
    });

    switch (action) {
      case ClickAction.clearCell: {
        if (!entryId) {
          return;
        }

        this.removeEntryFromActiveGrid(entryId, gridCellId);
        break;
      }
      case ClickAction.clearGrid: {
        this.handleClear();
        break;
      }
      case ClickAction.configureCell: {
        try {
          const { x, y } = getGridElementsPosition($(e.target).parent());

          const cellToConfigure: GmScreenGridEntry = this.activeGrid.entries[entryId] || {
            x,
            y,
            entryId: `${x}-${y}`,
          };

          log(false, 'configureCell cellToConfigure', cellToConfigure);

          const { newSpanRows, newSpanCols } = await getUserCellConfigurationInput(cellToConfigure, {
            rows: this.rows,
            columns: this.columns,
          });

          log(false, 'new span values from dialog', {
            newSpanRows,
            newSpanCols,
          });

          const newCell = {
            ...cellToConfigure,
            spanRows: newSpanRows,
            spanCols: newSpanCols,
          };

          const newEntries = {
            ...this.activeGrid.entries,
            [newCell.entryId]: newCell,
          };

          // based on the X, Y, and Span values of `newCell` find all problematic entryIds
          // BRITTLE if entryId's formula changes
          const problemCoordinates = [...Array(newCell.spanCols).keys()]
            .map((_, index) => {
              const problemX = newCell.x + index;

              return [...Array(newCell.spanRows).keys()].map((_k, i) => {
                const problemY = newCell.y + i;
                return `${problemX}-${problemY}`; // problem cell's id
              });
            })
            .flat();

          log(false, {
            problemCoordinates,
          });

          // get any overlapped cells and remove them
          Object.values(newEntries).forEach((entry) => {
            if (problemCoordinates.includes(entry.entryId) && entry.entryId !== newCell.entryId) {
              delete newEntries[entry.entryId];
            }
          });

          log(false, 'newEntries', newEntries);

          const newGridData = {
            ...this.activeGrid,
            entries: newEntries,
          };

          this.setGridData(newGridData);
        } catch (error) {
          log(false, 'User exited configure cell Dialog.', error);
        }
        break;
      }
      case ClickAction.open: {
        if (!entityUuid) {
          return;
        }
        try {
          const relevantDocument = await this.getRelevantGmScreenDocument(entityUuid);
          const relevantDocumentSheet = relevantDocument?.sheet;
          log(false, 'trying to edit entity', { relevantEntitySheet: relevantDocumentSheet });

          if (!relevantDocumentSheet) {
            return;
          }

          // If the relevantEntitySheet is already rendered:
          if (relevantDocumentSheet.rendered) {
            relevantDocumentSheet.maximize();
            relevantDocumentSheet.bringToTop();
            return;
          }
          if (relevantDocument instanceof JournalEntryPage && relevantDocument.type === 'image') {
            const ip = new foundry.applications.apps.ImagePopout({
              src: relevantDocumentSheet.options.document.src,
              uuid: entityUuid,
              window: { title: relevantDocument.name },
            });

            // Display the image popout
            ip.render({ force: true });
            return;
          }
          // Otherwise render the relevantEntitySheet
          relevantDocumentSheet.render(true);
        } catch (error) {
          log(true, 'error opening entity sheet', error);
        }
        break;
      }
      case ClickAction.refresh: {
        this.refresh();
        break;
      }
      case ClickAction.tab: {
        const newActiveGridId = e.currentTarget.dataset.tab;
        this.currentTab = newActiveGridId ?? this.currentTab;
        // do nothing if we are not the GM or if nothing changes
        if (!getGame().user?.isGM || newActiveGridId === this.data.activeGridId || !newActiveGridId) {
          return;
        }

        log(false, 'trying to set active grid', { newActiveGridId });

        try {
          const newGmScreenConfig = {
            ...this.data,
            activeGridId: newActiveGridId,
          };

          await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, newGmScreenConfig);
        } catch (error) {
          log(true, 'error setting active tab', error);
        }
        break;
      }
      case ClickAction.toggleGmScreen: {
        try {
          this.toggleGmScreenVisibility();
        } catch (error) {
          log(true, 'error toggling GM Screen', error);
        }
        break;
      }
      case ClickAction.statBlock: {
        if (!gridCellId) {
          return;
        }
        const newEntries = {
          ...this.activeGrid.entries,
        };
        newEntries[entryId].isDndNpcStatBlock = !newEntries[entryId].isDndNpcStatBlock;
        const newGridData: GmScreenGrid = {
          ...this.activeGrid,
          entries: newEntries,
        };

        await this.setGridData(newGridData);
        break;
      }
      default:
    }
  }

  async switchTab() {
    const tabs = Object.keys(this.userViewableGrids);
    if (tabs.length <= 1) {
      return;
    }

    const isGM = getGame().user?.isGM;
    const currentIndex = tabs.indexOf(isGM ? this.data.activeGridId : this.currentTab);
    const newIndex = (currentIndex + 1) % tabs.length;
    const newActiveGridId = tabs[newIndex];

    log(false, 'trying to set active grid', { newActiveGridId });

    try {
      this.changeTab(newActiveGridId, TAB_GROUP_NAME);
      this.currentTab = newActiveGridId;

      if (!isGM) {
        return;
      }

      const newGmScreenConfig = {
        ...this.data,
        activeGridId: newActiveGridId,
      };
      await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, newGmScreenConfig);
    } catch (error) {
      log(true, 'error setting active tab', error);
    }
  }

  updateClassesAndFixButtons() {
    const html = $('#gm-screen-app');
    if (!this.displayDrawer) {
      html.addClass('application');
      html.find('.window-content').prepend(html.find('.window-header'));
    }
  }

  async _renderFrame(options) {
    if (!this.displayDrawer) {
      return super._renderFrame(options);
    }
    const template = $(
      await foundry.applications.handlebars.renderTemplate(TEMPLATES.screen, await this._prepareContext(this.options))
    ).get(0);
    if (!template) {
      throw new Error('Failed to render GmScreenApplication frame template');
    }

    return template;
  }

  /**
   * @override
   */
  render(...args) {
    if (!this.hasUserViewableGrids && this.rendered) {
      this.close();
    }

    return super.render(...args);
  }

  /**
   * This currently thinly wraps `this.render`, but might be more complicated in the future.
   */
  async refresh() {
    const newData = getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig);
    const oldData = foundry.utils.deepClone(this.data);
    const diffData: Partial<GmScreenConfig> = foundry.utils.diffObject(oldData, newData);

    log(false, 'refreshing gm screen', {
      newData: foundry.utils.deepClone(newData),
      data: oldData,
      diffData,
    });

    this.data = newData;

    if (Object.keys(diffData).length) {
      if (
        Object.keys(diffData).every((key) => key === 'activeGridId') ||
        Object.values(diffData.grids || {}).every((grid) => Object.keys(grid).every((key) => key === 'cssClass'))
      ) {
        log(false, 'not rerendering because only activeGridId changed or cssClass changed');
        return;
      }

      const diffGridIds = Object.keys(diffData?.grids ?? {});
      const myNewGridIds = Object.keys(this.userViewableGrids);
      const myOldGridIds = Object.keys(getUserViewableGrids(oldData));

      // 1. check if the gridIds in diffData have no overlap with the gridIds I can currently see

      const diffOverlapsNewGridIds = !diffGridIds.filter((gridId) => myNewGridIds.includes(gridId)).length;
      // expect this to be false if there is overlap;

      // 2. check if the gridIds I can currently see are the same as before the diff

      const oldAndNewGridIdsAreEqual =
        myNewGridIds.length === myOldGridIds.length && myNewGridIds.every((gridId) => myOldGridIds.includes(gridId));
      // expect this to be true if same

      // 3. IF 1 AND 2; don't rerender

      const shouldNotRerender = diffOverlapsNewGridIds && oldAndNewGridIdsAreEqual;

      log(false, 'gridIdChecks', {
        diffGridIds,
        myOldGridIds,
        myNewGridIds,
        diffOverlapsNewGridIds,
        oldAndNewGridIdsAreEqual,
        shouldNotRerender,
      });

      if (shouldNotRerender) {
        log(false, 'not rerendering because none of my visible grids changed');
        return;
      }
    }

    if (!this.displayDrawer) {
      await this.close();
    }

    this.render(true);
  }

  async _onRender() {
    const dragDrop = new foundry.applications.ux.DragDrop({
      dragSelector: '.gm-screen-grid-cell',
      dropSelector: '.gm-screen-grid-cell',
      permissions: { dragstart: () => !!getGame().user?.isGM, drop: () => !!getGame().user?.isGM },
      callbacks: { drop: this._onDrop.bind(this) },
    });
    dragDrop.bind(this.element);

    const dragDropTabs = new foundry.applications.ux.DragDrop({
      dragSelector: '.gm-screen-actions button',
      dropSelector: '.gm-screen-actions button',
      permissions: { dragstart: () => !!getGame().user?.isGM, drop: () => !!getGame().user?.isGM },
      callbacks: {
        dragstart: this._dragStartTab.bind(this),
        dragover: this._dragOverTab.bind(this),
        dragend: this._dragEndTab.bind(this),
      },
    });
    dragDropTabs.bind(this.element);

    if (this.displayDrawer) {
      this.setPosition({
        left: NaN,
        top: NaN,
      });
    } else {
      this.setPosition({
        width: Number(this.columns) * 400,
        height: Number(this.rows) * 300,
      });
    }

    const html = $(this.element);

    $('.gm-screen-button').on('contextmenu', async () => {
      if (!getGame().user?.isGM) {
        return;
      }

      const config = new GmScreenSettings({});
      await config.render({ force: true });
    });

    // stop here if there are no user viewable grids
    if (!this.hasUserViewableGrids) {
      return;
    }

    this.injectCellContents(html);
    this.updateClassesAndFixButtons();

    // populate the --grid-cell-width variable
    const vanillaGridElement = document.querySelector('.gm-screen-grid');
    if (!vanillaGridElement) {
      return;
    }
    const vanillaGridElementStyles = getComputedStyle(vanillaGridElement);
    const cols = vanillaGridElementStyles['grid-template-columns'].split(' ');
    const colWidth = cols[0];

    $(html)
      .find('.gm-screen-grid')
      .each((i, gridElement) => {
        gridElement.style.setProperty('--grid-cell-width', colWidth);
      });
  }

  /**
   * @override
   */
  async _attachFrameListeners() {
    super._attachFrameListeners();

    const html = $(this.element);

    $(html).on('click', '.gm-screen-actions button', this.handleClickEvent.bind(this));
    $(html).on('click', '.gm-screen-grid-cell-header a', this.handleClickEvent.bind(this));
  }

  /**
   * Utility method to help typescript understand that these are only
   * actors, items, journals, or rolltables
   *
   * @param entityUuid - relevant entityUuid
   */
  async getRelevantGmScreenDocument(
    entityUuid
  ): Promise<Actor | Item | JournalEntry | RollTable | JournalEntryPage | undefined> {
    const relevantDocument = await fromUuid(entityUuid);

    if (
      !(
        relevantDocument instanceof Actor ||
        relevantDocument instanceof Item ||
        relevantDocument instanceof JournalEntry ||
        relevantDocument instanceof RollTable ||
        relevantDocument instanceof JournalEntryPage
      )
    ) {
      return undefined;
    }

    return relevantDocument;
  }

  /**
   * create and cache the custom Application when we need to during GmScreenApplication.render();
   * and then use that cached Application instance to render
   *
   * @param entityUuid - Identifier for the Entity in the cell
   * @param cellId - Identifier for the Cell
   * @param gridCellContentElement - the element to inject into
   * @returns
   */
  async getCellApplicationClass(
    entityUuid: string,
    cellId: string,
    dndNpc: boolean,
    dndNpcStatBlock: boolean
  ): Promise<GmScreenApp | undefined> {
    const relevantDocument = await this.getRelevantGmScreenDocument(entityUuid);

    if (!relevantDocument) {
      await this.apps[cellId]?.close();
      delete this.apps[cellId];

      // eslint-disable-next-line no-console
      console.warn('One of the grid cells tried to render an entity that does not exist.', entityUuid);
      return undefined;
    }

    /* If there is an old app here which isn't this entity's, destroy it */
    if (this.apps[cellId] && this.apps[cellId]?.document.uuid !== entityUuid) {
      await this.apps[cellId].close();
      delete this.apps[cellId];
    }

    const { sheet } = relevantDocument;
    const SheetClass = sheet?.constructor;

    /* If the currently cached sheet class does not match the sheet class, destroy it */
    if (this.apps[cellId] && this.apps[cellId].constructor.name !== SheetClass?.name) {
      await this.apps[cellId].close();
      delete this.apps[cellId];
    }

    /* If the currently cached sheet class does match the sheet class, return it */
    if (this.apps[cellId] && this.apps[cellId].constructor.name === SheetClass?.name) {
      // when dealing with DnD5e NPC stat blocks, we need to make sure we re-create the sheet if the user toggled the stat block option
      if (!dndNpc || this.apps[cellId].id.includes(dndNpcStatBlock ? 'gmscreen-npc-' : 'gmscreen-actor-')) {
        log(false, `using cached application instance for "${relevantDocument.name}"`, {
          entityUuid,
          app: this.apps[cellId],
        });

        return this.apps[cellId];
      }
    }

    log(false, 'relevantEntity sheet', {
      sheet,
      name: SheetClass?.name,
    });

    if (!SheetClass) {
      log(true, 'no sheet class found for relevantDocument', {
        relevantDocument,
        entityUuid,
      });
      return undefined;
    }

    switch (true) {
      case relevantDocument instanceof JournalEntry:
        log(false, `creating compact journal entry for "${relevantDocument.name}"`, {
          cellId,
        });

        this.apps[cellId] = new CompactJournalEntryDisplay({
          document: relevantDocument,
          editable: false,
          cellId,
        });
        break;

      // special case when the sheet is a journal text page. We need to use the SheetClass to resolve UUID links
      case sheet instanceof foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet &&
        relevantDocument instanceof JournalEntryPage &&
        sheet.options.document.type === 'text':
        log(false, `creating compact JournalEntryPage for "${relevantDocument.name}"`, {
          cellId,
        });

        // eslint-disable-next-line no-case-declarations
        const TextDocumentSheet: foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet & CustomOptions =
          new (SheetClass as JournalEntryPageProseMirrorSheetConstructor)({
            ...sheet.options,
            mode: 'view',
            id: `gmscreen-text-${sheet.document.id}`,
            // needed to show the journal page with styles
            classes: ['application', 'sheet', 'journal-sheet', 'journal-entry', 'maximizing'],
            document: relevantDocument,
            window: {
              ...sheet.options.window,
              frame: false,
              positioned: false,
              resizable: false,
            },
          });

        TextDocumentSheet._postRender = async function internalPostRender() {
          this.cellId = cellId;

          $(this.cellId).find('.gm-screen-grid-cell-title').text(this.options.document.name);

          const gridCellContent = $(this.cellId).find('.gm-screen-grid-cell-content');
          gridCellContent.removeClass().addClass(['gm-screen-grid-cell-content']);
          gridCellContent.html(this.form);
          gridCellContent
            .children()
            // needed to show the journal page with styles
            .wrapInner("<section class='journal-entry-content journal-entry-page overflow-y'></section>");
          gridCellContent.find('.window-header').remove();
        };

        TextDocumentSheet.close = emptyClose;

        this.apps[cellId] = TextDocumentSheet;
        break;

      case relevantDocument instanceof JournalEntryPage:
        log(false, `creating compact JournalEntryPage for "${relevantDocument.name}"`, {
          cellId,
        });

        this.apps[cellId] = new CompactJournalEntryPageDisplay({ document: relevantDocument, cellId });
        break;

      case relevantDocument instanceof RollTable:
        log(false, `creating compact rollTableDisplay for "${relevantDocument.name}"`, {
          cellId,
        });

        this.apps[cellId] = new CompactRollTableDisplay({ document: relevantDocument, cellId });
        break;

      case sheet instanceof foundry.applications.sheets.ActorSheetV2 && relevantDocument instanceof Actor:
        log(false, `creating ActorSheetV2 for "${relevantDocument.name}"`, {
          cellId,
        });

        // eslint-disable-next-line no-case-declarations
        const ActorDocumentSheet: foundry.applications.sheets.ActorSheetV2 & CustomOptions =
          new (SheetClass as ActorV2Constructor)({
            ...sheet.options,
            id: dndNpcStatBlock ? `gmscreen-npc-${sheet.document.id}` : `gmscreen-actor-${sheet.document.id}`,
            classes: [],
            document: relevantDocument,
            window: {
              ...sheet.options.window,
              frame: true,
              positioned: false,
              resizable: isActorOrItemResizable(relevantDocument.constructor.name),
            },
          });

        ActorDocumentSheet._postRender = async function postRender() {
          this.cellId = cellId;

          $(this.cellId).find('.gm-screen-grid-cell-title').text(this.title);

          const gridCellContent = $(this.cellId).find('.gm-screen-grid-cell-content');
          gridCellContent.removeClass().addClass(['gm-screen-grid-cell-content']);

          gridCellContent.html(this.form);
          if (!dndNpcStatBlock) {
            gridCellContent.find('.window-header').css('visibility', 'hidden');
            return;
          }

          gridCellContent.addClass('dnd5e2');
          gridCellContent.html(
            (await relevantDocument.toEmbed({
              label: '',
              values: ['statblock'],
              inline: false,
              cite: true,
              caption: false,
              captionPosition: 'bottom',
            })) || this.form
          );
          gridCellContent
            .children()
            .wrap("<div class='dnd5e2-journal journal-entry-content journal-page-content'></div>");
        };
        ActorDocumentSheet.close = emptyClose;

        this.apps[cellId] = ActorDocumentSheet;
        break;

      case sheet instanceof foundry.applications.api.DocumentSheetV2 && relevantDocument instanceof Item:
        log(false, `creating ItemSheetV2 for "${relevantDocument.name}"`, {
          cellId,
        });

        // eslint-disable-next-line no-case-declarations
        const ItemDocumentSheet: foundry.applications.sheets.ItemSheetV2 & CustomOptions =
          new (SheetClass as ItemV2Constructor)({
            ...sheet.options,
            id: `gmscreen-item-${sheet.document.id}`,
            document: relevantDocument,
            window: {
              ...sheet.options.window,
              frame: true,
              positioned: false,
              resizable: false,
            },
          });

        ItemDocumentSheet._postRender = postRenderV2(cellId);
        ItemDocumentSheet.close = emptyClose;

        this.apps[cellId] = ItemDocumentSheet;
        break;

      default:
        log(false, `creating compact generic for "${relevantDocument.name}"`, {
          cellId,
        });

        // eslint-disable-next-line no-case-declarations
        const CompactDocumentSheet: (ItemSheet & CustomOptions) | (ActorSheet & CustomOptions) =
          new (SheetClass as ItemAndActorV1Constructor)(relevantDocument, {
            ...sheet.options,
            width: '100%',
            height: '100%',
            positioned: false,
            resizable: isActorOrItemResizable(relevantDocument.constructor.name),
          });

        CompactDocumentSheet.options.editable = false;
        CompactDocumentSheet.options.popOut = false;
        CompactDocumentSheet.cellId = cellId;

        CompactDocumentSheet._injectHTML = function injectHTML(html) {
          $(this.cellId).find('.gm-screen-grid-cell-title').text(this.title);

          const gridCellContent = $(this.cellId).find('.gm-screen-grid-cell-content');

          log(false, 'CompactEntitySheet overwritten _injectHTML', {
            targetElement: gridCellContent,
            gridCellContent,
            cellId: this.cellId,
            html,
          });
          gridCellContent.append(html);
          gridCellContent.children().wrap("<section class='window-content'></section>");
          this._element = html;
        };

        CompactDocumentSheet._replaceHTML = function replaceHTML(element, html) {
          $(this.cellId).find('.gm-screen-grid-cell-title').text(this.title);

          const gridCellContent = $(this.cellId).find('.gm-screen-grid-cell-content');
          const pureHTML = html.get(0);
          if (!pureHTML) {
            return;
          }
          gridCellContent.html(pureHTML);
          gridCellContent.children().wrap("<section class='window-content'></section>");
          this._element = html;
        };

        log(false, `created compact generic for "${relevantDocument.name}"`, {
          sheet: CompactDocumentSheet,
        });

        this.apps[cellId] = CompactDocumentSheet;
    }

    return this.apps[cellId];
  }

  injectCellContents(html: JQuery) {
    $(html)
      .find('[data-entity-uuid]')
      .each((index, gridEntry) => {
        try {
          // `this` is the parent .gm-screen-grid-cell
          const relevantUuid = gridEntry.dataset.entityUuid;
          if (!relevantUuid) {
            return;
          }
          const cellId = `#${gridEntry.id}`;
          const { entryId, dndNpc, dndNpcStatBlock } = gridEntry.dataset;

          log(false, 'gridEntry with uuid defined found', { relevantUuid, cellId, gridEntry });

          this.getCellApplicationClass(relevantUuid, cellId, dndNpc === 'true', dndNpcStatBlock === 'true')
            .then(async (application) => {
              log(false, `got application for "${cellId}"`, {
                application,
              });

              if (!application) {
                if (entryId) {
                  // remove old applications that can't be rendered
                  await this.removeEntryFromActiveGrid(entryId, cellId.replace('#', ''));
                }

                throw new Error('no application exists to render');
              }

              const classes = application.options.classes.join(' ');

              const gridCellContent = $(gridEntry).find('.gm-screen-grid-cell-content');
              gridCellContent.addClass(classes);

              application.render(true);
            })
            .catch((e) => {
              log(true, 'error trying to render a gridEntry', {
                gridEntry,
                cellId,
                relevantUuid,
                error: e,
              });
            });
        } catch (e) {
          log(false, 'erroring', e, {
            gridEntry,
          });
        }
      });

    // set some CSS Variables for child element use
    updateCSSPropertyVariable(html, '.gm-screen-grid-cell', 'width', '--this-cell-width');

    return html;
  }

  /**
   * All grids with entries hydrated with empty cells
   */
  getHydratedGrids() {
    log(false, 'getHydratedGrids', {
      userViewableGrids: this.userViewableGrids,
    });

    return Object.values(this.userViewableGrids).reduce<
      Record<string, { grid: GmScreenGrid; gridEntries: Partial<GmScreenGridEntry>[] }>
    >((acc, grid: GmScreenGrid) => {
      const gridColumns = grid.columnOverride ?? this.columns;
      const gridRows = grid.rowOverride ?? this.rows;

      const emptyCellsNum = Number(gridColumns) * Number(gridRows) - GmScreenApplication.getNumOccupiedCells(grid);
      const emptyCells: Partial<GmScreenGridEntry>[] =
        emptyCellsNum > 0 ? Array.from({ length: emptyCellsNum }).map(() => ({})) : [];

      acc[grid.id] = {
        grid,
        gridEntries: [...Object.values(grid.entries), ...emptyCells],
      };

      return acc;
    }, {});
  }

  /**
   * @override
   */
  async _prepareContext(options) {
    const rightMargin = getGame().settings.get(MODULE_ID, MySettings.rightMargin);
    const drawerWidth = getGame().settings.get(MODULE_ID, MySettings.drawerWidth);
    const drawerHeight = getGame().settings.get(MODULE_ID, MySettings.drawerHeight);
    const drawerOpacity = getGame().settings.get(MODULE_ID, MySettings.drawerOpacity);
    const condensedButton = getGame().settings.get(MODULE_ID, MySettings.condensedButton);

    const grids = this.getHydratedGrids();

    const currentIndex = Object.keys(grids).indexOf(this.data.activeGridId);
    this.tabGroups[TAB_GROUP_NAME] = currentIndex !== -1 ? this.data.activeGridId : Object.keys(grids)[0];
    Object.keys(grids).forEach((gridId) => {
      grids[gridId].grid.cssClass = this.tabGroups[TAB_GROUP_NAME] === grids[gridId].grid.id ? 'active' : '';
    });

    const newAppData = foundry.utils.mergeObject(options, {
      grids,
      isGM: !!getGame().user?.isGM,
      condensedButton,
      data: this.data,
      columns: this.columns,
      rows: this.rows,
      drawerWidth,
      drawerHeight,
      rightMargin,
      drawerOpacity,
      expanded: this.expanded,
      hidden: !this.hasUserViewableGrids,
      displayDrawer: this.displayDrawer,
      darkTheme: getGame().settings.get('core', 'uiConfig')?.colorScheme?.interface === 'dark',
    });

    newAppData.tabs = Object.keys(grids).map((id) => ({
      id: grids[id].grid.id,
      group: TAB_GROUP_NAME,
      label: grids[id].grid.name,
      cssClass: grids[id].grid.cssClass,
    }));

    log(false, '_prepareContext', {
      data: this.data,
      newAppData,
    });

    return newAppData;
  }

  async _onDrop(event) {
    event.stopPropagation();

    // do nothing if this user is not the gm
    if (!getGame().user?.isGM) return;

    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (error) {
      log(false, 'error parsing data from drag and drop', error);
      return;
    }

    log(false, 'onDrop', {
      event,
      data,
      closestGridCell: $(event.currentTarget).closest('.gm-screen-grid-cell'),
    });

    // only move forward if this is a JournalEntry or RollTable
    if (!['JournalEntry', 'JournalEntryPage', 'RollTable', 'Item', 'Actor'].includes(data.type)) {
      return;
    }

    const entityUuid = data.pack ? `Compendium.${data.pack}.${data.uuid}` : data.uuid;

    const gridElementPosition = getGridElementsPosition($(event.target).closest('.gm-screen-grid-cell'));
    const newEntryId = `${gridElementPosition.x}-${gridElementPosition.y}`;

    const relevantDocument = await this.getRelevantGmScreenDocument(entityUuid);

    const newEntry: GmScreenGridEntry = {
      ...gridElementPosition,
      entryId: newEntryId,
      entityUuid,
      type: data.type,
      isDndNpc:
        relevantDocument instanceof Actor &&
        getGame().system.id === 'dnd5e' &&
        relevantDocument?.sheet?.constructor.name === 'NPCActorSheet',
      isDndNpcStatBlock: false,
    };

    this.addEntryToActiveGrid(newEntry);
  }
}
