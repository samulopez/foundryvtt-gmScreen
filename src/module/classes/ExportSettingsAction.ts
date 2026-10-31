import { ScreenConfigTransfer } from '../screenConfigTransfer';

export class ExportSettingsAction extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static PARTS = {};

  override async render(_options?: unknown, _legacyOptions?: unknown): Promise<this> {
    await ScreenConfigTransfer.exportSettings();
    return this;
  }
}
