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
    return `gmscreen-journal-${this.document.id}`;
  }
}
