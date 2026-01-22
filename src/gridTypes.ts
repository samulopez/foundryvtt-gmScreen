export interface GmScreenConfig {
  grids: Record<string, GmScreenGrid>; // object of all grids keyed by uuid
  activeGridId: keyof GmScreenConfig['grids']; // currently visible grid's id
}

export interface GmScreenGrid {
  entries: Record<string, GmScreenGridEntry>; // keyed by cellId
  id: string; // grid's uuid
  name: string; // user configurable
  isShared: boolean;
  rowOverride?: number;
  columnOverride?: number;
  cssClass: string; // used for styling the grid container
}

export interface GmScreenGridEntry {
  x: number;
  y: number;
  spanRows?: number;
  spanCols?: number;
  entityUuid?: string;
  type?: 'JournalEntry' | 'JournalEntryPage' | 'RollTable' | 'Item' | 'Actor' | 'Image';
  entryId: string;
  isDndNpc?: boolean;
  isDndNpcStatBlock?: boolean;
  imagePath?: string;
}

export interface GmScreenApi {
  toggleGmScreenVisibility(isOpen?: boolean): void;
  refreshGmScreen(): void;
  switchTab(): Promise<void>;
}
