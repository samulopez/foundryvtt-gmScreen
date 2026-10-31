import { GmScreenConfig, GmScreenGridEntry } from '../gridTypes';

import { getGame, getLocalization, log } from './helpers';
import { MODULE_ABBREV, MODULE_ID, MySettings } from './constants';

type ExportableDocumentName = 'Actor' | 'Item' | 'JournalEntry' | 'RollTable';

interface ExportedDocumentReference {
  uuid: string;
  pageId?: string;
}

interface ExportedDocument {
  documentName: ExportableDocumentName;
  data: Record<string, unknown>;
  sourceUuids: ExportedDocumentReference[];
}

interface ScreenConfigExport {
  format: 'gm-screen-export';
  moduleId: typeof MODULE_ID;
  moduleVersion: string;
  systemId: string;
  worldName?: string;
  settings: {
    gmScreenConfig: GmScreenConfig;
    rows: number;
    columns: number;
  };
  documents: ExportedDocument[];
  unresolvedReferences: string[];
}

interface ResolvedTransferDocument {
  uuid: string;
  documentName: ExportableDocumentName;
  data: Record<string, unknown>;
  sourceUuids: ExportedDocumentReference[];
}

interface PreparedDocument {
  documentName: ExportableDocumentName;
  sourceUuids: ExportedDocumentReference[];
  data: Record<string, unknown>;
  createdId: string;
}

const exportableDocumentNames = new Set<ExportableDocumentName>(['Actor', 'Item', 'JournalEntry', 'RollTable']);

function localize(key: string) {
  return getLocalization().localize(`${MODULE_ABBREV}.${key}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown) {
  return value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isFinite(value));
}

function isGridEntry(value: unknown): value is GmScreenGridEntry {
  if (
    !isRecord(value) ||
    typeof value.entryId !== 'string' ||
    typeof value.x !== 'number' ||
    !Number.isFinite(value.x) ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.y) ||
    (value.entityUuid !== undefined && typeof value.entityUuid !== 'string') ||
    (value.imagePath !== undefined && typeof value.imagePath !== 'string') ||
    (value.isDndNpc !== undefined && typeof value.isDndNpc !== 'boolean') ||
    (value.isDndNpcStatBlock !== undefined && typeof value.isDndNpcStatBlock !== 'boolean') ||
    !isOptionalNumber(value.spanRows) ||
    !isOptionalNumber(value.spanCols)
  ) {
    return false;
  }

  return (
    value.type === undefined ||
    ['JournalEntry', 'JournalEntryPage', 'RollTable', 'Item', 'Actor', 'Image'].includes(value.type as string)
  );
}

function isGmScreenConfig(value: unknown): value is GmScreenConfig {
  if (!isRecord(value) || typeof value.activeGridId !== 'string' || !isRecord(value.grids)) {
    return false;
  }

  return (
    Object.hasOwn(value.grids, value.activeGridId) &&
    Object.values(value.grids).every(
      (grid) =>
        isRecord(grid) &&
        typeof grid.id === 'string' &&
        typeof grid.name === 'string' &&
        typeof grid.isShared === 'boolean' &&
        typeof grid.cssClass === 'string' &&
        isOptionalNumber(grid.rowOverride) &&
        isOptionalNumber(grid.columnOverride) &&
        isRecord(grid.entries) &&
        Object.values(grid.entries).every(isGridEntry)
    )
  );
}

function isExportableDocumentName(value: unknown): value is ExportableDocumentName {
  return typeof value === 'string' && exportableDocumentNames.has(value as ExportableDocumentName);
}

function resolveReplacement(uuid: string, replacements: Map<string, string>) {
  let resolved = uuid;
  const seen = new Set<string>();

  while (!seen.has(resolved)) {
    seen.add(resolved);
    const directReplacement = replacements.get(resolved);
    if (directReplacement) {
      resolved = directReplacement;
    } else {
      const currentUuid = resolved;
      const parentReplacement = [...replacements.keys()]
        .filter((sourceUuid) => currentUuid.startsWith(`${sourceUuid}.`))
        .sort((left, right) => right.length - left.length)[0];
      if (!parentReplacement) break;

      resolved = `${replacements.get(parentReplacement)}${resolved.slice(parentReplacement.length)}`;
    }
  }

  return resolved;
}

function validateExport(value: unknown): ScreenConfigExport {
  if (
    !isRecord(value) ||
    value.format !== 'gm-screen-export' ||
    value.moduleId !== MODULE_ID ||
    typeof value.moduleVersion !== 'string' ||
    typeof value.systemId !== 'string' ||
    value.systemId.length === 0 ||
    (value.worldName !== undefined && typeof value.worldName !== 'string') ||
    !isRecord(value.settings) ||
    !isGmScreenConfig(value.settings.gmScreenConfig) ||
    typeof value.settings.rows !== 'number' ||
    !Number.isFinite(value.settings.rows) ||
    value.settings.rows <= 0 ||
    typeof value.settings.columns !== 'number' ||
    !Number.isFinite(value.settings.columns) ||
    value.settings.columns <= 0 ||
    !Array.isArray(value.documents) ||
    !value.documents.every(
      (document) =>
        isRecord(document) &&
        isExportableDocumentName(document.documentName) &&
        isRecord(document.data) &&
        typeof document.data._id === 'string' &&
        Array.isArray(document.sourceUuids) &&
        document.sourceUuids.length > 0 &&
        document.sourceUuids.some((reference) => isRecord(reference) && reference.pageId === undefined) &&
        document.sourceUuids.every(
          (reference) =>
            isRecord(reference) &&
            typeof reference.uuid === 'string' &&
            (reference.pageId === undefined || typeof reference.pageId === 'string')
        )
    ) ||
    !Array.isArray(value.unresolvedReferences) ||
    !value.unresolvedReferences.every((uuid) => typeof uuid === 'string')
  ) {
    throw new Error(localize('settings.transfer.InvalidFile'));
  }

  return value as unknown as ScreenConfigExport;
}

function selectJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    document.body.append(input);

    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.click();
  });
}

function collectSourceReferences(document: JournalEntry | Actor | Item | RollTable): ExportedDocumentReference[] {
  const references: ExportedDocumentReference[] = document.uuid ? [{ uuid: document.uuid }] : [];

  if (document instanceof JournalEntry) {
    references.push(
      ...document.pages.contents.flatMap((page) => (page.id ? [{ uuid: page.uuid, pageId: page.id }] : []))
    );
  }

  return references;
}

async function resolveExportDocument(uuid: string): Promise<ResolvedTransferDocument | null> {
  let resolved: Awaited<ReturnType<typeof fromUuid>>;
  try {
    resolved = await fromUuid(uuid);
  } catch (error) {
    log(false, 'Could not resolve exported document reference', { uuid, error });
    return null;
  }
  const document = resolved instanceof JournalEntryPage ? resolved.parent : resolved;

  if (
    !document ||
    !(
      document instanceof Actor ||
      document instanceof Item ||
      document instanceof JournalEntry ||
      document instanceof RollTable
    )
  ) {
    return null;
  }

  const { documentName, uuid: documentUuid } = document;
  if (!isExportableDocumentName(documentName) || !documentUuid) {
    return null;
  }

  return {
    uuid: documentUuid,
    documentName,
    data: document.toObject(),
    sourceUuids: collectSourceReferences(document),
  };
}

function getEntries(config: GmScreenConfig): GmScreenGridEntry[] {
  return Object.values(config.grids).flatMap((grid) => Object.values(grid.entries));
}

function replaceReferences(value: unknown, replacements: Map<string, string>, fieldName?: string): unknown {
  if (typeof value === 'string') {
    if (fieldName?.toLowerCase().includes('uuid')) {
      return resolveReplacement(value, replacements);
    }

    return value
      .replace(/(@(?:UUID|Embed)\[)([^\]\s]+)([^\]]*\])/g, (match, prefix: string, uuid: string, suffix: string) => {
        const replacement = resolveReplacement(uuid, replacements);
        return replacement !== uuid ? `${prefix}${replacement}${suffix}` : match;
      })
      .replace(/(data-uuid=(['"])([^'"]+)\2)/g, (match, _attribute: string, _quote: string, uuid: string) => {
        const replacement = resolveReplacement(uuid, replacements);
        return replacement !== uuid ? match.replace(uuid, replacement) : match;
      });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replaceReferences(entry, replacements, fieldName));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceReferences(entry, replacements, key)])
    );
  }

  return value;
}

function remapScreenEntries(config: GmScreenConfig, replacements: Map<string, string>): GmScreenConfig {
  const copiedConfig = foundry.utils.deepClone(config);
  return {
    ...copiedConfig,
    grids: Object.fromEntries(
      Object.entries(copiedConfig.grids).map(([gridId, grid]) => [
        gridId,
        {
          ...grid,
          entries: Object.fromEntries(
            Object.entries(grid.entries).map(([entryId, entry]) => [
              entryId,
              entry.entityUuid ? { ...entry, entityUuid: resolveReplacement(entry.entityUuid, replacements) } : entry,
            ])
          ),
        },
      ])
    ),
  };
}

function notify(type: 'info' | 'warn' | 'error', message: string) {
  ui.notifications?.[type](message);
}

function sanitizeFilename(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'world'
  );
}

export class ScreenConfigTransfer {
  static async exportSettings() {
    if (!getGame().user?.isGM) return;

    try {
      const settings: ScreenConfigExport['settings'] = {
        gmScreenConfig: foundry.utils.deepClone(getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig)),
        rows: getGame().settings.get(MODULE_ID, MySettings.rows),
        columns: getGame().settings.get(MODULE_ID, MySettings.columns),
      };
      const documentsByUuid = new Map<string, ResolvedTransferDocument>();
      const unresolvedReferences = new Set<string>();

      const entriesToExport = getEntries(settings.gmScreenConfig).filter(
        (entry) => entry.entityUuid && entry.type !== 'Image'
      );
      const resolvedEntries = await Promise.all(
        entriesToExport.map(async (entry) => {
          const uuid = entry.entityUuid;
          return { entry, document: uuid ? await resolveExportDocument(uuid) : null };
        })
      );
      resolvedEntries.forEach(({ entry, document: exportedDocument }) => {
        if (!exportedDocument) {
          if (entry.entityUuid) unresolvedReferences.add(entry.entityUuid);
          return;
        }
        documentsByUuid.set(exportedDocument.uuid, exportedDocument);
      });

      const bundle: ScreenConfigExport = {
        format: 'gm-screen-export',
        moduleId: MODULE_ID,
        moduleVersion: getGame().modules.get(MODULE_ID)?.version ?? 'unknown',
        systemId: getGame().system.id,
        worldName: getGame().world?.title ?? 'World',
        settings,
        documents: [...documentsByUuid.values()].map((document) => ({
          documentName: document.documentName,
          data: document.data,
          sourceUuids: document.sourceUuids,
        })),
        unresolvedReferences: [...unresolvedReferences],
      };

      const date = new Date();
      const exportDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      foundry.utils.saveDataToFile(
        JSON.stringify(bundle, null, 2),
        'application/json',
        `gm-screen-${sanitizeFilename(bundle.worldName ?? 'World')}-settings-${exportDate}.json`
      );

      if (unresolvedReferences.size > 0) {
        notify('warn', localize('settings.transfer.MissingDocumentsExported'));
      } else {
        notify('info', localize('settings.transfer.ExportComplete'));
      }
    } catch (error) {
      log(false, 'Failed to export screen configuration', error);
      notify('error', localize('settings.transfer.ExportFailed'));
    }
  }

  static async importSettings() {
    if (!getGame().user?.isGM) return;

    const file = await selectJsonFile();
    if (!file) return;

    let bundle: ScreenConfigExport;
    try {
      bundle = validateExport(JSON.parse(await foundry.utils.readTextFromFile(file)));
    } catch (error) {
      log(false, 'Invalid screen configuration file', error);
      notify('error', localize('settings.transfer.InvalidFile'));
      return;
    }

    if (bundle.systemId !== getGame().system.id) {
      notify('error', localize('settings.transfer.SystemMismatch'));
      return;
    }

    const confirmation = await foundry.applications.api.DialogV2.input({
      window: { title: localize('settings.transfer.ConfirmTitle') },
      content: `
        <p>${localize('settings.transfer.ConfirmContent')}</p>
        <p>${localize('settings.transfer.ExternalFilesHint')}</p>
        <label class="checkbox">
          <input type="checkbox" name="importDocuments" checked>
          ${localize('settings.transfer.ImportDocuments')}
        </label>
      ` as foundry.applications.api.DialogV2.Content<{ importDocuments: boolean }>,
      ok: { label: localize('settings.transfer.ConfirmImport') },
      rejectClose: false,
    });

    if (!confirmation || typeof confirmation !== 'object') return;

    const importDocuments = Boolean(confirmation.importDocuments);
    const createdDocuments: { delete: () => Promise<unknown> }[] = [];
    let settingsChanged = false;
    const previousSettings = {
      gmScreenConfig: foundry.utils.deepClone(getGame().settings.get(MODULE_ID, MySettings.gmScreenConfig)),
      rows: getGame().settings.get(MODULE_ID, MySettings.rows),
      columns: getGame().settings.get(MODULE_ID, MySettings.columns),
    };

    try {
      const documents = importDocuments
        ? await Promise.all(
            bundle.documents.map(async (document) => {
              const documentClass = getDocumentClass(document.documentName) as unknown as {
                fromImport: (data: Record<string, unknown>) => Promise<{ toObject: () => Record<string, unknown> }>;
              };
              const migrated = await documentClass.fromImport(foundry.utils.deepClone(document.data));
              return { ...document, data: migrated.toObject() };
            })
          )
        : [];
      const replacements = importDocuments ? this.#prepareDocumentReferences(documents) : new Map<string, string>();
      if (importDocuments) {
        const preparedDocuments = this.#prepareDocuments(documents, replacements);
        const results = await Promise.allSettled(
          preparedDocuments.map(async (prepared) => {
            const documentClass = getDocumentClass(prepared.documentName) as unknown as {
              create: (
                data: Record<string, unknown>,
                options: { keepId: boolean; keepEmbeddedIds: boolean }
              ) => Promise<{ uuid: string; delete: () => Promise<unknown> }>;
            };
            return {
              prepared,
              created: await documentClass.create(prepared.data, { keepId: true, keepEmbeddedIds: true }),
            };
          })
        );
        const createdRecords = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
        createdDocuments.push(...createdRecords.map(({ created }) => created));
        createdRecords.forEach(({ prepared, created }) => {
          const createdUuid = created.uuid;
          const expectedUuid = `${prepared.documentName}.${prepared.createdId}`;
          if (createdUuid !== expectedUuid) {
            replacements.set(expectedUuid, createdUuid);
          }
        });
        const failedResult = results.find((result) => result.status === 'rejected');
        if (failedResult?.status === 'rejected') throw failedResult.reason;
      }

      settingsChanged = true;
      await getGame().settings.set(MODULE_ID, MySettings.rows, bundle.settings.rows);
      await getGame().settings.set(MODULE_ID, MySettings.columns, bundle.settings.columns);
      await getGame().settings.set(
        MODULE_ID,
        MySettings.gmScreenConfig,
        remapScreenEntries(bundle.settings.gmScreenConfig, replacements)
      );

      if (bundle.unresolvedReferences.length > 0) {
        notify('warn', localize('settings.transfer.MissingDocumentsImported'));
      } else {
        notify('info', localize('settings.transfer.ImportComplete'));
      }
    } catch (error) {
      log(false, 'Failed to import screen configuration', error);
      const documentsRolledBack = await this.#rollback(createdDocuments);
      const settingsRestored = !settingsChanged || (await this.#restoreSettings(previousSettings));
      notify(
        'error',
        documentsRolledBack && settingsRestored
          ? localize('settings.transfer.ImportFailed')
          : localize('settings.transfer.ImportRollbackFailed')
      );
    }
  }

  static #prepareDocumentReferences(documents: ExportedDocument[]) {
    const replacements = new Map<string, string>();
    documents.forEach((document) => {
      const createdId = foundry.utils.randomID();
      const createdUuid = `${document.documentName}.${createdId}`;
      document.sourceUuids.forEach((reference) => {
        if (reference.pageId) {
          const newPageId = foundry.utils.randomID();
          replacements.set(reference.uuid, `${createdUuid}.JournalEntryPage.${newPageId}`);
        } else {
          replacements.set(reference.uuid, createdUuid);
        }
      });
    });
    return replacements;
  }

  static #prepareDocuments(documents: ExportedDocument[], replacements: Map<string, string>): PreparedDocument[] {
    return documents.map((document) => {
      const data = foundry.utils.deepClone(document.data);
      const rootUuid = document.sourceUuids.find((reference) => !reference.pageId)?.uuid;
      const createdUuid = rootUuid ? replacements.get(rootUuid) : undefined;
      if (!createdUuid) throw new Error(localize('settings.transfer.InvalidFile'));

      const createdId = createdUuid.split('.').at(-1);
      if (!createdId) throw new Error(localize('settings.transfer.InvalidFile'));
      data._id = createdId;
      data.folder = null;

      if (document.documentName === 'JournalEntry' && Array.isArray(data.pages)) {
        data.pages = data.pages.map((page) => {
          if (!isRecord(page) || typeof page._id !== 'string') return page;
          const sourcePage = document.sourceUuids.find((reference) => reference.pageId === page._id);
          const targetPageUuid = sourcePage ? replacements.get(sourcePage.uuid) : undefined;
          const targetPageId = targetPageUuid?.split('.').at(-1);
          return targetPageId ? { ...page, _id: targetPageId } : page;
        });
      }

      return {
        ...document,
        data: replaceReferences(data, replacements) as Record<string, unknown>,
        createdId,
      };
    });
  }

  static async #rollback(documents: { delete: () => Promise<unknown> }[]) {
    return [...documents].reverse().reduce(async (successPromise, document) => {
      let success = await successPromise;
      try {
        await document.delete();
      } catch (error) {
        log(false, 'Failed to roll back an imported document', error);
        success = false;
      }
      return success;
    }, Promise.resolve(true));
  }

  static async #restoreSettings(previous: { gmScreenConfig: GmScreenConfig; rows: number; columns: number }) {
    try {
      await getGame().settings.set(MODULE_ID, MySettings.rows, previous.rows);
      await getGame().settings.set(MODULE_ID, MySettings.columns, previous.columns);
      await getGame().settings.set(MODULE_ID, MySettings.gmScreenConfig, previous.gmScreenConfig);
      return true;
    } catch (error) {
      log(false, 'Failed to restore screen settings after an import error', error);
      return false;
    }
  }
}
