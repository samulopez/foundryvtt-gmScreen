import { GmScreenConfig, GmScreenGridEntry } from '../gridTypes';

import { MODULE_ABBREV, MODULE_ID, RESIZABLE_DOCUMENTS, numberRegex } from './constants';

interface LocalizationHelper {
  localize: (key: string) => string;
}

export function getGame(): foundry.Game {
  if (!(game instanceof foundry.Game)) {
    throw new Error('game is not initialized yet!');
  }
  return game;
}

export function getLocalization(): LocalizationHelper {
  const { i18n } = getGame();
  if (!i18n) {
    return {
      localize: (key: string) => key,
    };
  }
  return i18n;
}

export function log(force: boolean, ...args) {
  const shouldLog = force || getGame().modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);

  if (shouldLog) {
    // eslint-disable-next-line no-console
    console.log(MODULE_ID, '|', ...args);
  }
}

export function getUserCellConfigurationInput(
  cellToConfigure: GmScreenGridEntry,
  gridDetails: {
    rows: number;
    columns: number;
  }
) {
  return new Promise<{
    newSpanRows: number;
    newSpanCols: number;
  }>((resolve, reject) => {
    new foundry.applications.api.DialogV2({
      window: { title: getLocalization().localize(`${MODULE_ABBREV}.cellConfigDialog.CellConfig`) },
      modal: true,
      content: `
    <div class="form-group">
      <label for="spanRows">${getLocalization().localize(`${MODULE_ABBREV}.cellConfigDialog.RowSpan`)}</label>
      <input type="number" step="1" name="spanRows" id="spanRows" min="1" max="${gridDetails.rows + 1 - cellToConfigure.y}" value="${
        cellToConfigure.spanRows || 1
      }">
    </div>
    <div class="form-group">
      <label for="spanCols">${getLocalization().localize(`${MODULE_ABBREV}.cellConfigDialog.ColSpan`)}</label>
      <input type="number" step="1" name="spanCols" id="spanCols" min="1" max="${
        gridDetails.columns + 1 - cellToConfigure.x
      }" value="${cellToConfigure.spanCols || 1}">
    </div>  
`,
      buttons: [
        {
          action: 'no',
          icon: 'fas fa-times',
          label: getLocalization().localize('Cancel'),
          callback: () => {
            reject();
          },
        },
        {
          action: 'reset',
          icon: 'fas fa-undo',
          label: getLocalization().localize('Default'),
          callback: () => {
            const formValues = {
              newSpanRows: 1,
              newSpanCols: 1,
            };

            log(false, 'dialog formValues', formValues);

            resolve(formValues);
          },
        },
        {
          action: 'yes',
          icon: 'fas fa-check',
          label: getLocalization().localize('Submit'),
          default: true,
          callback: (_event, button, dialog) => {
            const html = dialog.element;
            const formValues = {
              newSpanRows: Number(html.querySelector('[name="spanRows"]')?.value),
              newSpanCols: Number(html.querySelector('[name="spanCols"]')?.value),
            };

            log(false, 'dialog formValues', formValues);

            resolve(formValues);
          },
        },
      ],
    }).render({ force: true });
  });
}

export function getGridElementsPosition(element: HTMLElement) {
  const relevantGridElement = element.parentElement?.closest('.gm-screen-grid');
  if (!relevantGridElement) {
    return { x: 1, y: 1 };
  }

  const vanillaGridElementStyles = window.getComputedStyle(relevantGridElement);

  log(false, 'getGridElementsPosition', {
    element,
    relevantGridElement,
    vanillaGridElementStyles,
    gap: vanillaGridElementStyles.gap, // wtf this is '' in firefox
    gridRowGap: vanillaGridElementStyles['grid-row-gap'],
    gridColGap: vanillaGridElementStyles['grid-column-gap'],
  });

  const gap = Number(vanillaGridElementStyles['grid-row-gap'].match(numberRegex)[0]);

  // Get the css attribute grid-template-columns from the css of class grid
  // split on whitespace and get the length, this will give you the column dimensions
  const cols = vanillaGridElementStyles['grid-template-columns'].split(' ');
  const colWidth = Number(cols[0].match(numberRegex)[0]);

  // Get the css attribute grid-template-rows from the css of class grid
  // split on whitespace and get the length, this will give you the column dimensions
  const rows = vanillaGridElementStyles['grid-template-rows'].split(' ');
  const rowHeight = Number(rows[0].match(numberRegex)[0]);

  // to figure out which column/row this element is in within the gridElement, we have to do math
  const elementBounds = element.getBoundingClientRect();
  const gridBounds = relevantGridElement.getBoundingClientRect();

  const elementColumn = Math.floor((elementBounds.left - (gridBounds.left - gap)) / (colWidth + gap)) + 1;

  const elementRow = Math.floor((elementBounds.top - (gridBounds.top - gap)) / (rowHeight + gap)) + 1;

  log(false, 'getGridElementsPosition', {
    setup: {
      gap,
      cols,
      rows,
      elementBounds,
      gridBounds,
      colWidth,
      rowHeight,
    },
    results: {
      elementColumn,
      elementRow,
    },
  });
  // Return an object with properties row and column
  return { y: elementRow, x: elementColumn };
}

export function getUserViewableGrids(gmScreenConfig: GmScreenConfig) {
  if (getGame().user?.isGM) {
    return gmScreenConfig.grids;
  }

  const sharedGrids = Object.keys(gmScreenConfig.grids).reduce((acc, gridId) => {
    if (gmScreenConfig.grids[gridId].isShared) {
      acc[gridId] = gmScreenConfig.grids[gridId];
    }

    return acc;
  }, {});

  return sharedGrids;
}

/**
 * Creates a custom CSS property with the name provide on the element.style of all elements which match
 * the selector provided containing the computed value of the property specified.
 *
 */
export function updateCSSPropertyVariable(
  html: HTMLElement,
  selector: string,
  property: keyof CSSStyleDeclaration,
  name: string
) {
  html.querySelectorAll(selector).forEach((gridCell) => {
    if (!(gridCell instanceof HTMLElement)) {
      return;
    }
    const value = window.getComputedStyle(gridCell)[property];
    gridCell.style.setProperty(name, String(value));
  });
}

export function postRenderV2(cellId: string) {
  return async function internalPostRenderV2() {
    this.cellId = cellId;

    const cell = document.getElementById(this.cellId.replace('#', ''));

    if (!cell) {
      return;
    }

    const title = cell.querySelector('.gm-screen-grid-cell-title');

    if (title) {
      title.textContent = this.title;
    }

    const gridCellContent = cell.querySelector('.gm-screen-grid-cell-content');
    if (!gridCellContent) {
      return;
    }

    gridCellContent.classList.remove(...Array.from(gridCellContent.classList));
    gridCellContent.classList.add('gm-screen-grid-cell-content');

    gridCellContent.replaceChildren(this.form);
    const header = gridCellContent.querySelector('.window-header');
    if (header instanceof HTMLElement) {
      header.style.visibility = 'hidden';
    }
  };
}

// prevent closing if esc is pressed
export function emptyClose() {
  return this;
}

export function isActorOrItemResizable(documentName: string) {
  return RESIZABLE_DOCUMENTS.includes(documentName);
}
