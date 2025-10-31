export class CompactJournalEntryDisplay extends foundry.applications.sheets.journal.JournalEntrySheet {
  cellId: string;

  constructor(options) {
    super(options);
    this.cellId = options.cellId;
    this.options.position.width = 'auto';
    this.options.position.height = 'auto';
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

    const cell = document.getElementById(this.cellId.replace('#', ''));
    if (!cell) {
      return;
    }
    const titleElement = cell.querySelector('.gm-screen-grid-cell-title');
    if (titleElement) {
      titleElement.textContent = this.title;
    }

    const gridCellContent = cell.querySelector('.gm-screen-grid-cell-content');
    if (gridCellContent) {
      gridCellContent.replaceChildren(this.form);
      const windowHeader = gridCellContent.querySelector('.window-header');
      if (windowHeader) {
        windowHeader.remove();
      }
    }
    this.setPosition({
      width: 'auto',
      height: 'auto',
      left: 0,
      top: 0,
    });
  }

  /** @override */
  get id() {
    return `gmscreen-journal-${this.document.id}`;
  }

  async close(...args) {
    if (args.length === 0) {
      return super.close(...args);
    }
    // prevent closing if esc is pressed
    return this;
  }
}
