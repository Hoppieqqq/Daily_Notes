import { Notice, Plugin } from 'obsidian';
import { DailyNoteResolver } from './dailyResolver';
import { DEFAULT_SETTINGS, DailyFloatingNoteSettings, COMMAND_IDS } from './settings';
import { DailyFloatingNoteSettingTab } from './settingsTab';
import { FloatingWindowManager } from './windowManager';

export default class DailyFloatingNotePlugin extends Plugin {
  public settings: DailyFloatingNoteSettings = structuredClone(DEFAULT_SETTINGS);
  public dailyResolver!: DailyNoteResolver;
  private windowManager!: FloatingWindowManager;

  public async onload(): Promise<void> {
    await this.loadSettings();

    this.dailyResolver = new DailyNoteResolver(this.app);
    this.windowManager = new FloatingWindowManager(this.app, {
      getSettings: () => this.settings,
      saveSettingsPatch: async (patch) => {
        this.settings = { ...this.settings, ...patch };
        await this.saveSettings();
      },
    });

    this.addSettingTab(new DailyFloatingNoteSettingTab(this.app, this));
    this.registerCommands();

    this.registerEvent(
      this.app.workspace.on('window-close', (_workspaceWindow, closedWindow) => {
        void this.windowManager.onWorkspaceWindowClosed(closedWindow);
      }),
    );

    new Notice('Daily Floating Note loaded.');
  }

  public async onunload(): Promise<void> {
    await this.windowManager.persistWindowState();
    this.windowManager.destroy();
  }

  public async openDailyInFloatingWindow(offsetDays: number, forceOpen = false): Promise<void> {
    try {
      const file = await this.dailyResolver.getOrCreateDailyFile(this.settings, offsetDays);

      if (!forceOpen && this.windowManager.hasWindow()) {
        switch (this.settings.repeatHotkeyBehavior) {
          case 'focus':
            await this.windowManager.openFile(file, this.settings.openMode);
            return;
          case 'toggle-visibility':
            await this.windowManager.toggleVisibilityOrFocus(file, this.settings.openMode);
            return;
          case 'reopen':
            await this.windowManager.closeWindow();
            break;
        }
      }

      await this.windowManager.openFile(file, this.settings.openMode);
    } catch (error) {
      console.error('[daily-floating-note] openDailyInFloatingWindow error:', error);
      new Notice('Не удалось открыть daily note. Проверьте настройки источника и шаблона.');
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: COMMAND_IDS.OPEN_TODAY,
      name: 'Open floating daily note for today',
      hotkeys: [{ modifiers: ['Alt'], key: 'f' }],
      callback: () => {
        void this.openDailyInFloatingWindow(0);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_YESTERDAY,
      name: 'Open floating daily note for yesterday',
      callback: () => {
        void this.openDailyInFloatingWindow(-1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_TOMORROW,
      name: 'Open floating daily note for tomorrow',
      callback: () => {
        void this.openDailyInFloatingWindow(1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.TOGGLE_PIN,
      name: 'Toggle always-on-top for floating daily window',
      callback: async () => {
        const pinned = await this.windowManager.togglePinned();
        new Notice(pinned ? 'Floating daily window pinned.' : 'Floating daily window unpinned.');
      },
    });

    this.addCommand({
      id: COMMAND_IDS.CLOSE_WINDOW,
      name: 'Close floating daily window',
      callback: async () => {
        await this.windowManager.closeWindow();
      },
    });
  }

  public async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), data ?? {});
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
