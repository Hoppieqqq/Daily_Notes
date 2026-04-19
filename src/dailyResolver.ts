import { App, Notice, TAbstractFile, TFile, moment, normalizePath } from 'obsidian';
import { DailyFloatingNoteSettings, DailySource } from './settings';

export interface DailyConfig {
  folder: string;
  dateFormat: string;
  templatePath: string;
  sourceLabel: string;
}

interface DailySourceOptions {
  folder?: unknown;
  format?: unknown;
  dateFormat?: unknown;
  template?: unknown;
  templateFile?: unknown;
  templatePath?: unknown;
}

interface DailyNotesPluginInstance {
  options?: DailySourceOptions;
  settings?: DailySourceOptions;
}

interface DailyNotesPluginLike {
  _loaded?: boolean;
  enabled?: boolean;
  options?: DailySourceOptions;
  instance?: DailyNotesPluginInstance;
}

interface InternalPluginsApi {
  getPluginById?: (id: string) => DailyNotesPluginLike | undefined;
  plugins?: Record<string, DailyNotesPluginLike | undefined>;
  getEnabledPlugins?: () => Set<string> | undefined;
}

interface PeriodicNotesPluginLike {
  settings?: { daily?: DailySourceOptions };
  options?: { daily?: DailySourceOptions };
}

interface AppWithDailyPluginInternals extends App {
  internalPlugins?: InternalPluginsApi;
  plugins?: {
    plugins?: Record<string, PeriodicNotesPluginLike | undefined>;
  };
}

interface ObsidianMoment {
  add(amount: number, unit: string): ObsidianMoment;
  format(pattern: string): string;
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

export class DailyNoteResolver {
  constructor(private readonly app: App) {}

  public async getOrCreateDailyFile(settings: DailyFloatingNoteSettings, offsetDays = 0): Promise<TFile> {
    const config = this.resolveDailyConfig(settings);
    const targetDate = this.getMoment().add(offsetDays, 'days');
    const filename = `${targetDate.format(config.dateFormat)}.md`;
    const path = config.folder
      ? normalizePath(`${config.folder}/${filename}`)
      : normalizePath(filename);

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      return existing;
    }

    if (existing) {
      throw new Error(`Daily note path points to a folder: ${path}`);
    }

    await this.ensureFolder(config.folder);
    const content = await this.readTemplateContent(config.templatePath, targetDate);
    return this.app.vault.create(path, content);
  }

  public resolveDailyConfig(settings: DailyFloatingNoteSettings): DailyConfig {
    const fromSource = this.getConfigFromSource(settings.dailySource);
    if (fromSource) {
      return fromSource;
    }

    if (settings.dailySource !== 'plugin-custom') {
      new Notice('The selected daily note source is unavailable, so plugin settings will be used.');
    }

    return {
      folder: settings.customFolder.trim(),
      dateFormat: settings.customDateFormat.trim() || DEFAULT_DATE_FORMAT,
      templatePath: settings.customTemplatePath.trim(),
      sourceLabel: 'Plugin settings',
    };
  }

  public isSourceAvailable(source: DailySource): boolean {
    if (source === 'plugin-custom') {
      return true;
    }
    if (source === 'core-daily-notes') {
      return this.getCoreDailySettings() !== null;
    }
    if (source === 'periodic-notes') {
      return this.getPeriodicDailySettings() !== null;
    }
    return false;
  }

  public getTemplateFile(settings: DailyFloatingNoteSettings): TFile | null {
    const config = this.resolveDailyConfig(settings);
    if (!config.templatePath) {
      return null;
    }
    const file: TAbstractFile | null = this.app.vault.getAbstractFileByPath(normalizePath(config.templatePath));
    return file instanceof TFile ? file : null;
  }

  private getConfigFromSource(source: DailySource): DailyConfig | null {
    if (source === 'plugin-custom') {
      return null;
    }

    if (source === 'core-daily-notes') {
      const core = this.getCoreDailySettings();
      return core
        ? {
            folder: core.folder,
            dateFormat: core.format,
            templatePath: core.template,
            sourceLabel: 'Daily Notes core plugin',
          }
        : null;
    }

    if (source === 'periodic-notes') {
      const periodic = this.getPeriodicDailySettings();
      return periodic
        ? {
            folder: periodic.folder,
            dateFormat: periodic.format,
            templatePath: periodic.template,
            sourceLabel: 'Periodic Notes plugin',
          }
        : null;
    }

    return null;
  }

  private getCoreDailySettings(): { folder: string; format: string; template: string } | null {
    const internalPlugins = (this.app as AppWithDailyPluginInternals).internalPlugins;
    const plugin = internalPlugins?.getPluginById?.('daily-notes') ?? internalPlugins?.plugins?.['daily-notes'];
    const enabledPlugins = internalPlugins?.getEnabledPlugins?.();
    const enabled = enabledPlugins?.has('daily-notes') ?? plugin?._loaded ?? plugin?.enabled;

    if (!enabled || !plugin) {
      return null;
    }

    const options = plugin.instance?.options ?? plugin.instance?.settings ?? plugin.options ?? null;
    if (!options) {
      return null;
    }

    return this.normalizeDailySourceOptions(options);
  }

  private getPeriodicDailySettings(): { folder: string; format: string; template: string } | null {
    const periodicPlugin = (this.app as AppWithDailyPluginInternals).plugins?.plugins?.['periodic-notes'];
    if (!periodicPlugin) {
      return null;
    }

    const settings = periodicPlugin.settings?.daily ?? periodicPlugin.options?.daily ?? null;
    if (!settings) {
      return null;
    }

    return this.normalizeDailySourceOptions(settings);
  }

  private normalizeDailySourceOptions(options: DailySourceOptions): { folder: string; format: string; template: string } {
    return {
      folder: this.readString(options.folder),
      format: this.readString(options.format) || this.readString(options.dateFormat) || DEFAULT_DATE_FORMAT,
      template: this.readString(options.template) || this.readString(options.templateFile) || this.readString(options.templatePath),
    };
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath.trim());
    if (!normalized) {
      return;
    }

    const segments = normalized.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private async readTemplateContent(templatePath: string, date: ObsidianMoment): Promise<string> {
    if (!templatePath.trim()) {
      return '';
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(templatePath.trim()));
    if (!(file instanceof TFile)) {
      return '';
    }

    const raw = await this.app.vault.read(file);
    return raw
      .replaceAll('{{date}}', date.format(DEFAULT_DATE_FORMAT))
      .replaceAll('{{time}}', date.format('HH:mm'));
  }

  private getMoment(input?: Date | string): ObsidianMoment {
    const createMoment = moment as unknown as (value?: Date | string) => ObsidianMoment;
    return createMoment(input);
  }
}
