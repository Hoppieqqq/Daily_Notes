import { Notice, Plugin } from 'obsidian';
import { DailyNoteResolver } from './dailyResolver';
import { GlobalShortcutManager } from './globalShortcutManager';
import { COMMAND_IDS, DEFAULT_SETTINGS, DailyFloatingNoteSettings } from './settings';
import { DailyFloatingNoteSettingTab } from './settingsTab';
import { FloatingWindowManager } from './windowManager';

export default class DailyFloatingNotePlugin extends Plugin {
  public settings: DailyFloatingNoteSettings = structuredClone(DEFAULT_SETTINGS);
  public dailyResolver!: DailyNoteResolver;
  private windowManager: FloatingWindowManager | null = null;
  private globalShortcutManager: GlobalShortcutManager | null = null;

  public onload(): void {
    void this.initializePlugin();
  }

  public onunload(): void {
    void this.teardownPlugin();
  }

  public async openDailyInFloatingWindow(offsetDays: number, forceOpen = false): Promise<void> {
    if (!this.windowManager) {
      throw new Error('Daily floating note is not initialized yet.');
    }

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
      new Notice('Could not open the daily note. Check the source and template settings.');
    }
  }

  public isGlobalShortcutRegistered(): boolean {
    return this.globalShortcutManager?.isRegistered() ?? false;
  }

  public async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), data ?? {});
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async initializePlugin(): Promise<void> {
    try {
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
          void this.windowManager?.onWorkspaceWindowClosed(closedWindow);
        }),
      );

      new Notice('Daily floating note loaded.');
    } catch (error) {
      console.error('[daily-floating-note] plugin initialization failed:', error);
      new Notice('Daily floating note could not finish loading.');
    }
  }

  private async teardownPlugin(): Promise<void> {
    this.globalShortcutManager?.unregister();
    this.globalShortcutManager = null;

    if (this.windowManager) {
      await this.windowManager.persistWindowState();
      this.windowManager.destroy();
      this.windowManager = null;
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: COMMAND_IDS.OPEN_TODAY,
      name: "Open today's floating daily note",
      callback: () => {
        void this.openDailyInFloatingWindow(0);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_YESTERDAY,
      name: "Open yesterday's floating daily note",
      callback: () => {
        void this.openDailyInFloatingWindow(-1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.OPEN_TOMORROW,
      name: "Open tomorrow's floating daily note",
      callback: () => {
        void this.openDailyInFloatingWindow(1, true);
      },
    });

    this.addCommand({
      id: COMMAND_IDS.TOGGLE_PIN,
      name: 'Toggle always-on-top for the floating daily window',
      callback: async () => {
        if (!this.windowManager) {
          return;
        }
        const pinned = await this.windowManager.togglePinned();
        new Notice(pinned ? 'Floating window is now pinned on top.' : 'Floating window is no longer pinned on top.');
      },
    });

    this.addCommand({
      id: COMMAND_IDS.CLOSE_WINDOW,
      name: 'Close the floating daily window',
      callback: async () => {
        await this.windowManager?.closeWindow();
      },
    });
  }

  private registerGlobalShortcut(): void {
    const registered = this.globalShortcutManager?.register() ?? false;
    if (!registered) {
      console.warn('[daily-floating-note] Global Alt+F shortcut is unavailable. Falling back to Obsidian commands only.');
    }
  }
}
