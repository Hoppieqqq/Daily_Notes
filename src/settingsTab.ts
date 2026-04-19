import { App, PluginSettingTab, Setting } from 'obsidian';
import DailyFloatingNotePlugin from './main';
import { DEFAULT_SETTINGS, DailySource, OpenMode, RepeatHotkeyBehavior } from './settings';

interface ObsidianSettingsApi {
  open(): void;
  openTabById(id: string): void;
}

type AppWithSettings = App & {
  setting?: ObsidianSettingsApi;
};

export class DailyFloatingNoteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: DailyFloatingNotePlugin) {
    super(app, plugin);
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('dfn-settings');

    new Setting(containerEl)
      .setName('Daily floating note')
      .setHeading();

    containerEl.createEl('p', {
      text: 'Use the Hotkeys section to assign command shortcuts for opening today, yesterday, or tomorrow, closing the floating window, and toggling always-on-top.',
      cls: 'dfn-settings-help',
    });

    new Setting(containerEl)
      .setName('Open hotkey settings')
      .setDesc(
        this.plugin.isGlobalShortcutRegistered()
          ? 'A global Alt+F shortcut is active while Obsidian is running. You can also assign command shortcuts in Obsidian.'
          : 'Command shortcuts can be assigned in Obsidian. The global Alt+F shortcut is unavailable in the current environment.',
      )
      .addButton((button) => {
        button
          .setButtonText('Open hotkeys')
          .setCta()
          .onClick(() => {
            const appWithSettings = this.app as AppWithSettings;
            appWithSettings.setting?.open();
            appWithSettings.setting?.openTabById('hotkeys');
          });
      });

    new Setting(containerEl)
      .setName('Pin window on top by default')
      .setDesc('Enable always-on-top when the floating window opens.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.pinByDefault)
          .onChange(async (value) => {
            this.plugin.settings.pinByDefault = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Remember pin state between sessions')
      .setDesc('Restore the last always-on-top state when the plugin opens the window again.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rememberPinState)
          .onChange(async (value) => {
            this.plugin.settings.rememberPinState = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Remember window size and position')
      .setDesc('Restore the last floating window bounds when it opens again.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rememberWindowBounds)
          .onChange(async (value) => {
            this.plugin.settings.rememberWindowBounds = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Daily note source')
      .setDesc('Choose between the Daily Notes core plugin, Periodic Notes, or this plugin’s own settings.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('core-daily-notes', 'Use Daily Notes core plugin')
          .addOption('periodic-notes', 'Use Periodic Notes plugin')
          .addOption('plugin-custom', 'Use plugin settings')
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
        ? 'The selected source is available.'
        : 'The selected source is unavailable, so the plugin will use its own settings.',
    );

    if (this.plugin.settings.dailySource === 'plugin-custom') {
      new Setting(containerEl)
        .setName('Daily notes folder')
        .setDesc('Use a path relative to the vault root.')
        .addText((text) =>
          text
            .setPlaceholder('daily')
            .setValue(this.plugin.settings.customFolder)
            .onChange(async (value) => {
              this.plugin.settings.customFolder = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName('Daily note filename format')
        .setDesc('Use a moment.js date pattern, for example yyyy-mm-dd.')
        .addText((text) =>
          text
            .setPlaceholder('yyyy-mm-dd')
            .setValue(this.plugin.settings.customDateFormat)
            .onChange(async (value) => {
              this.plugin.settings.customDateFormat = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName('Template file path')
        .setDesc('Use an optional Markdown template when the plugin creates a new daily note.')
        .addText((text) =>
          text
            .setPlaceholder('templates/daily.md')
            .setValue(this.plugin.settings.customTemplatePath)
            .onChange(async (value) => {
              this.plugin.settings.customTemplatePath = value;
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl)
      .setName('Repeat hotkey behavior')
      .setDesc('Choose what happens when the floating window is already open.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('focus', 'Focus the existing window')
          .addOption('toggle-visibility', 'Hide or show the existing window')
          .addOption('reopen', 'Reopen the floating window')
          .setValue(this.plugin.settings.repeatHotkeyBehavior)
          .onChange(async (value) => {
            this.plugin.settings.repeatHotkeyBehavior = value as RepeatHotkeyBehavior;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Open note mode')
      .setDesc('Choose whether the note opens in editing mode or reading mode.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('editing', 'Editing mode')
          .addOption('reading', 'Reading mode')
          .setValue(this.plugin.settings.openMode)
          .onChange(async (value) => {
            this.plugin.settings.openMode = value as OpenMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Open today’s daily note now')
      .setDesc('Run a quick test and open the floating window immediately.')
      .addButton((button) => {
        button.setButtonText('Open now').setCta().onClick(async () => {
          await this.plugin.openDailyInFloatingWindow(0, true);
        });
      });

    new Setting(containerEl)
      .setName('Reset plugin settings')
      .setDesc('Restore all plugin settings to their default values.')
      .addButton((button) => {
        button
          .setWarning()
          .setButtonText('Reset settings')
          .onClick(async () => {
            this.plugin.settings = structuredClone(DEFAULT_SETTINGS);
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }
}
