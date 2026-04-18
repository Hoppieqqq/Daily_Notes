import { App, Notice, TAbstractFile, TFile, moment, normalizePath } from 'obsidian';
import { DailyFloatingNoteSettings, DailySource } from './settings';

export interface DailyConfig {
  folder: string;
  dateFormat: string;
  templatePath: string;
  sourceLabel: string;
}

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
    return await this.app.vault.create(path, content);
  }

  public resolveDailyConfig(settings: DailyFloatingNoteSettings): DailyConfig {
    const fromSource = this.getConfigFromSource(settings.dailySource);
    if (fromSource) {
      return fromSource;
    }

    if (settings.dailySource !== 'plugin-custom') {
      new Notice('Источник daily недоступен, используется локальная конфигурация плагина.');
    }

    return {
      folder: settings.customFolder.trim(),
      dateFormat: settings.customDateFormat.trim() || 'YYYY-MM-DD',
      templatePath: settings.customTemplatePath.trim(),
      sourceLabel: 'Plugin custom settings',
    };
  }

  private getConfigFromSource(source: DailySource): DailyConfig | null {
    if (source === 'plugin-custom') {
      return null;
    }

    if (source === 'core-daily-notes') {
      const core = this.getCoreDailySettings();
      if (core) {
        return {
          folder: core.folder,
          dateFormat: core.format,
          templatePath: core.template,
          sourceLabel: 'Core Daily Notes',
        };
      }
      return null;
    }

    if (source === 'periodic-notes') {
      const periodic = this.getPeriodicDailySettings();
      if (periodic) {
        return {
          folder: periodic.folder,
          dateFormat: periodic.format,
          templatePath: periodic.template,
          sourceLabel: 'Periodic Notes',
        };
      }
      return null;
    }

    return null;
  }

  private getCoreDailySettings(): { folder: string; format: string; template: string } | null {
    const internalPlugins = (this.app as unknown as { internalPlugins?: any }).internalPlugins;
    const plugin = internalPlugins?.getPluginById?.('daily-notes') ?? internalPlugins?.plugins?.['daily-notes'];
    const enabled = internalPlugins?.getEnabledPlugins?.()?.has?.('daily-notes') ?? plugin?._loaded ?? plugin?.enabled;

    if (!enabled || !plugin) {
      return null;
    }

    const options = plugin.instance?.options ?? plugin.instance?.settings ?? plugin.options ?? null;
    if (!options) {
      return null;
    }

    return {
      folder: String(options.folder ?? '').trim(),
      format: String(options.format ?? options.dateFormat ?? 'YYYY-MM-DD').trim(),
      template: String(options.template ?? options.templateFile ?? '').trim(),
    };
  }

  private getPeriodicDailySettings(): { folder: string; format: string; template: string } | null {
    const periodicPlugin = (this.app as unknown as { plugins?: { plugins?: Record<string, any> } }).plugins?.plugins?.['periodic-notes'];
    if (!periodicPlugin) {
      return null;
    }

    const settings = periodicPlugin.settings?.daily ?? periodicPlugin.options?.daily ?? null;
    if (!settings) {
      return null;
    }

    return {
      folder: String(settings.folder ?? '').trim(),
      format: String(settings.format ?? settings.dateFormat ?? 'YYYY-MM-DD').trim(),
      template: String(settings.template ?? settings.templatePath ?? '').trim(),
    };
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

  private async readTemplateContent(templatePath: string, date: any): Promise<string> {
    if (!templatePath.trim()) {
      return '';
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(templatePath.trim()));
    if (!(file instanceof TFile)) {
      return '';
    }

    const raw = await this.app.vault.read(file);
    return raw
      .replaceAll('{{date}}', date.format('YYYY-MM-DD'))
      .replaceAll('{{time}}', date.format('HH:mm'));
  }

  private getMoment(input?: Date | string): any {
    return (moment as unknown as (value?: Date | string) => any)(input);
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
}
