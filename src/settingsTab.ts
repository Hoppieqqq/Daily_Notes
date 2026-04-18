import { App, PluginSettingTab, Setting } from 'obsidian';
import DailyFloatingNotePlugin from './main';
import { DEFAULT_SETTINGS, DailySource, RepeatHotkeyBehavior, OpenMode } from './settings';

export class DailyFloatingNoteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: DailyFloatingNotePlugin) {
    super(app, plugin);
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('dfn-settings');

    containerEl.createEl('h2', { text: 'Daily Floating Note' });
    containerEl.createEl('p', {
      text: 'Ниже на экране Hotkeys вы видите список команд плагина: открыть today / yesterday / tomorrow, закрыть окно и переключить закрепление поверх всех.',
      cls: 'dfn-settings-help',
    });

    new Setting(containerEl)
      .setName('Горячая клавиша открытия')
      .setDesc(
        this.plugin.isGlobalShortcutRegistered()
          ? 'Команда зарегистрирована в Obsidian и дополнительно продублирована как глобальный Alt+F, пока приложение запущено.'
          : 'Команда зарегистрирована в Obsidian. По умолчанию: Alt+F. Глобальный Alt+F недоступен в текущей среде, поэтому работает только внутри Obsidian.',
      )
      .addButton((button) => {
        button
          .setButtonText('Настроить хоткей')
          .setCta()
          .onClick(() => {
            const anyApp = this.app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } };
            anyApp.setting?.open?.();
            anyApp.setting?.openTabById?.('hotkeys');
          });
      });

    new Setting(containerEl)
      .setName('Закреплять окно поверх всех по умолчанию')
      .setDesc('При открытии popout-окна включать always-on-top.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.pinByDefault)
          .onChange(async (value) => {
            this.plugin.settings.pinByDefault = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Запоминать состояние закрепления между сессиями')
      .setDesc('Сохраняет последнее состояние "поверх всех" и применяет при следующем запуске.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rememberPinState)
          .onChange(async (value) => {
            this.plugin.settings.rememberPinState = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Запоминать размер и позицию окна')
      .setDesc('При повторном открытии popout используется последнее положение и размер.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rememberWindowBounds)
          .onChange(async (value) => {
            this.plugin.settings.rememberWindowBounds = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Источник daily notes')
      .setDesc('Core Daily Notes / Periodic Notes / собственные настройки плагина.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('core-daily-notes', 'Core Daily Notes plugin')
          .addOption('periodic-notes', 'Periodic Notes plugin')
          .addOption('plugin-custom', 'Собственные настройки плагина')
          .setValue(this.plugin.settings.dailySource)
          .onChange(async (value) => {
            this.plugin.settings.dailySource = value as DailySource;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const sourceInfo = containerEl.createDiv({ cls: 'dfn-source-info' });
    const sourceAvailable = this.plugin.dailyResolver.isSourceAvailable(this.plugin.settings.dailySource);
    sourceInfo.setText(
      sourceAvailable
        ? 'Источник доступен.'
        : 'Выбранный источник недоступен, плагин автоматически использует собственные настройки.',
    );

    if (this.plugin.settings.dailySource === 'plugin-custom') {
      new Setting(containerEl)
        .setName('Папка daily notes')
        .setDesc('Относительный путь внутри vault.')
        .addText((text) =>
          text
            .setPlaceholder('Daily')
            .setValue(this.plugin.settings.customFolder)
            .onChange(async (value) => {
              this.plugin.settings.customFolder = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName('Формат имени файла')
        .setDesc('Формат даты через moment.js, например YYYY-MM-DD.')
        .addText((text) =>
          text
            .setPlaceholder('YYYY-MM-DD')
            .setValue(this.plugin.settings.customDateFormat)
            .onChange(async (value) => {
              this.plugin.settings.customDateFormat = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName('Путь к шаблону')
        .setDesc('Опциональный markdown-шаблон для создания новой daily note.')
        .addText((text) =>
          text
            .setPlaceholder('Templates/Daily.md')
            .setValue(this.plugin.settings.customTemplatePath)
            .onChange(async (value) => {
              this.plugin.settings.customTemplatePath = value;
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl)
      .setName('Поведение при повторном нажатии хоткея')
      .setDesc('Что делать, если floating-окно уже открыто.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('focus', 'Фокусировать существующее окно')
          .addOption('toggle-visibility', 'Скрыть / показать окно')
          .addOption('reopen', 'Переоткрыть окно')
          .setValue(this.plugin.settings.repeatHotkeyBehavior)
          .onChange(async (value) => {
            this.plugin.settings.repeatHotkeyBehavior = value as RepeatHotkeyBehavior;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Режим открытия заметки')
      .setDesc('Редактирование (source) или чтение (preview).')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('editing', 'Редактирование')
          .addOption('reading', 'Чтение')
          .setValue(this.plugin.settings.openMode)
          .onChange(async (value) => {
            this.plugin.settings.openMode = value as OpenMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Открыть daily сейчас')
      .setDesc('Тестовый запуск открытия плавающей daily note.')
      .addButton((button) => {
        button.setButtonText('Открыть').setCta().onClick(async () => {
          await this.plugin.openDailyInFloatingWindow(0, true);
        });
      });

    new Setting(containerEl)
      .setName('Сбросить настройки')
      .setDesc('Вернуть все параметры к значениям по умолчанию.')
      .addButton((button) => {
        button
          .setWarning()
          .setButtonText('Сбросить')
          .onClick(async () => {
            this.plugin.settings = structuredClone(DEFAULT_SETTINGS);
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }
}
