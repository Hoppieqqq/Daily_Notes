import { Notice, Plugin } from 'obsidian';
import { DailyNoteResolver } from './dailyResolver';
import { GlobalShortcutManager } from './globalShortcutManager';
import { DEFAULT_SETTINGS, DailyFloatingNoteSettings, COMMAND_IDS } from './settings';
import { DailyFloatingNoteSettingTab } from './settingsTab';
import { FloatingWindowManager } from './windowManager';

export default class DailyFloatingNotePlugin extends Plugin {
  public settings: DailyFloatingNoteSettings = structuredClone(DEFAULT_SETTINGS);
  public dailyResolver!: DailyNoteResolver;
  private windowManager!: FloatingWindowManager;
  private globalShortcutManager!: GlobalShortcutManager;

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
    this.globalShortcutManager = new GlobalShortcutManager('Alt+F', async () => {
      await this.openDailyInFloatingWindow(0);
    });

    this.addSettingTab(new DailyFloatingNoteSettingTab(this.app, this));
    this.registerCommands();
    this.registerGlobalShortcut();

    this.registerEvent(
      this.app.workspace.on('window-close', (_workspaceWindow, closedWindow) => {
        void this.windowManager.onWorkspaceWindowClosed(closedWindow);
      }),
    );

    new Notice('Daily Floating Note загружен.');
  }

  public async onunload(): Promise<void> {
    this.globalShortcutManager.unregister();
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

  public isGlobalShortcutRegistered(): boolean {
    return this.globalShortcutManager?.isRegistered?.() ?? false;
  }

  private registerCommands(): void {
    this.addCommand({
      id: COMMAND_IDS.OPEN_TODAY,
      name: 'Открыть сегодняшнюю daily note в плавающем окне',
      hotkeys: [{ modifiers: ['Alt'], key: 'f' }],
      callback: () => {
        void this.openDailyInFloatingWindow(0);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_YESTERDAY,
      name: 'Открыть вчерашнюю daily note в плавающем окне',
      callback: () => {
        void this.openDailyInFloatingWindow(-1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_TOMORROW,
      name: 'Открыть завтрашнюю daily note в плавающем окне',
      callback: () => {
        void this.openDailyInFloatingWindow(1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.TOGGLE_PIN,
      name: 'Переключить закрепление поверх всех для плавающего окна',
      callback: async () => {
        const pinned = await this.windowManager.togglePinned();
        new Notice(pinned ? 'Плавающее окно закреплено поверх всех.' : 'Плавающее окно больше не закреплено.');
      },
    });

    this.addCommand({
      id: COMMAND_IDS.CLOSE_WINDOW,
      name: 'Закрыть плавающее окно daily note',
      callback: async () => {
        await this.windowManager.closeWindow();
      },
    });
  }

  private registerGlobalShortcut(): void {
    const registered = this.globalShortcutManager.register();
    if (!registered) {
      console.warn('[daily-floating-note] Global Alt+F shortcut is unavailable. Falling back to Obsidian hotkeys only.');
    }
  }

  public async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), data ?? {});
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
