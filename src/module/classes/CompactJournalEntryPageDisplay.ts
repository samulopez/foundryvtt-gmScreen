export class CompactJournalEntryPageDisplay extends foundry.applications.sheets.journal
  .JournalEntryPageHandlebarsSheet {
  cellId: string;

  constructor(options) {
    super(options);
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

    const cell = document.getElementById(this.cellId.replace('#', ''));
    if (!cell) {
      return;
    }
    const titleElement = cell.querySelector('.gm-screen-grid-cell-title');
    if (titleElement) {
      titleElement.textContent = this.options.document.name;
    }

    const gridCellContent = cell.querySelector('.gm-screen-grid-cell-content');
    if (!gridCellContent) {
      return;
    }

    switch (this.options.document.type) {
      case 'image':
        gridCellContent.innerHTML = `<img src="${this.options.document.src}" alt="${this.options.document.image.caption || 'image'}"></img>`;
        break;
      case 'pdf':
        gridCellContent.innerHTML = `<iframe src="scripts/pdfjs/web/viewer.html?file=/${this.options.document.src}"></iframe>`;
        break;
      case 'video':
        gridCellContent.innerHTML = `<video src="${this.options.document.src}" ${this.options.document.video.controls ? 'controls' : ''} ${this.options.document.video.autoplay ? 'autoplay' : ''}></video>`;
        break;
      default:
        if (this.options.document.text.content) {
          gridCellContent.innerHTML = this.options.document.text.content;
        }
    }

    this.form.style.display = 'none';
  }

  /** @override */
  get id() {
    return `gmscreen-journal-page-${this.document.id}`;
  }

  async close(...args) {
    if (args.length === 0) {
      return super.close(...args);
    }
    // prevent closing if esc is pressed
    return this;
  }
}
