import { log } from '../helpers';

export class CompactRollTableDisplay extends foundry.applications.sheets.RollTableSheet {
  cellId: string;

  constructor(options) {
    super(options);
    log(false, 'CompactRollTableDisplay constructor', {
      options,
    });
    this.cellId = options.cellId;
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get isEditable() {
    return false;
  }

  _replaceHTML(element, html, options) {
    super._replaceHTML(element, html, options);
    if (!this.form) {
      return;
    }

    $(this.cellId).find('.gm-screen-grid-cell-title').text(this.title);

    const gridCellContent = $(this.cellId).find('.gm-screen-grid-cell-content');
    gridCellContent.html(this.form);
    gridCellContent.find('.window-header').remove();
    this.setPosition({
      width: 'auto',
      height: 'auto',
      left: 0,
      top: 0,
    });
  }

  /** @override */
  get id() {
    return `gmscreen-rolltable-${this.document.id}`;
  }

  async close(...args) {
    if (args.length === 0) {
      return super.close(...args);
    }
    // prevent closing if esc is pressed
    return this;
  }
}
