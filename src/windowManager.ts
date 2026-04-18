import { App, Notice, TFile, WorkspaceLeaf, WorkspaceWindow } from 'obsidian';
import { DailyFloatingNoteSettings, OpenMode } from './settings';

interface FloatingWindowPersistence {
  getSettings: () => DailyFloatingNoteSettings;
  saveSettingsPatch: (patch: Partial<DailyFloatingNoteSettings>) => Promise<void>;
}

export class FloatingWindowManager {
  private leaf: WorkspaceLeaf | null = null;
  private workspaceWindow: WorkspaceWindow | null = null;
  private browserWindow: any | null = null;
  private geometrySaveTimer: number | null = null;
  private geometryHandler: (() => void) | null = null;

  constructor(
    private readonly app: App,
    private readonly persistence: FloatingWindowPersistence,
  ) {}

  public hasWindow(): boolean {
    return this.leaf !== null && this.workspaceWindow !== null;
  }

  public getCurrentFilePath(): string | null {
    const state = this.leaf?.getViewState();
    const filePath = (state?.state as Record<string, unknown> | undefined)?.file;
    return typeof filePath === 'string' ? filePath : null;
  }

  public async openFile(file: TFile, mode: OpenMode): Promise<void> {
    if (!this.leaf || this.isLeafDisposed(this.leaf)) {
      this.leaf = this.createPopoutLeaf();
    }

    await this.leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(this.leaf);
    await this.applyOpenMode(mode);

    this.workspaceWindow = this.findWorkspaceWindow(this.leaf);
    this.browserWindow = this.resolveBrowserWindow(this.workspaceWindow?.win ?? null);
    this.attachGeometryListeners();

    const settings = this.persistence.getSettings();
    const shouldPin = settings.rememberPinState
      ? settings.lastPinState
      : settings.pinByDefault;
    await this.setPinned(shouldPin, false);
    this.focusWindow();
  }

  public async focusWindow(): Promise<void> {
    if (this.browserWindow) {
      try {
        if (this.browserWindow.isMinimized?.()) {
          this.browserWindow.restore?.();
        }
        this.browserWindow.show?.();
        this.browserWindow.focus?.();
        return;
      } catch {
        // Fallback to workspace reveal.
      }
    }

    if (this.leaf) {
      await this.app.workspace.revealLeaf(this.leaf);
    }
  }

  public async toggleVisibilityOrFocus(file: TFile, mode: OpenMode): Promise<void> {
    if (!this.hasWindow()) {
      await this.openFile(file, mode);
      return;
    }

    if (this.browserWindow) {
      const currentPath = this.getCurrentFilePath();
      const sameFile = currentPath === file.path;
      if (this.browserWindow.isMinimized?.()) {
        this.browserWindow.restore?.();
        this.browserWindow.show?.();
        if (!sameFile && this.leaf) {
          await this.leaf.openFile(file, { active: true });
          await this.applyOpenMode(mode);
        }
        this.browserWindow.focus?.();
        return;
      }

      if (sameFile) {
        this.browserWindow.minimize?.();
        return;
      }

      if (this.leaf) {
        await this.leaf.openFile(file, { active: true });
      }
      await this.focusWindow();
      return;
    }

    await this.openFile(file, mode);
  }

  public async closeWindow(): Promise<void> {
    await this.persistWindowState();
    this.detachGeometryListeners();

    if (this.leaf) {
      this.leaf.detach();
    }
    this.leaf = null;
    this.workspaceWindow = null;
    this.browserWindow = null;
  }

  public async togglePinned(): Promise<boolean> {
    if (!this.browserWindow) {
      new Notice('Не удалось переключить закрепление: окно не поддерживает Electron bridge.');
      return false;
    }

    const current = this.browserWindow.isAlwaysOnTop?.() ?? false;
    const next = !current;
    await this.setPinned(next, true);
    return next;
  }

  public async setPinned(flag: boolean, persist = true): Promise<void> {
    if (!this.browserWindow) {
      return;
    }

    try {
      this.browserWindow.setAlwaysOnTop?.(flag, 'floating');
      if (persist) {
        await this.persistence.saveSettingsPatch({ lastPinState: flag });
      }
    } catch {
      new Notice('Не удалось изменить режим always-on-top на этой платформе.');
    }
  }

  public async onWorkspaceWindowClosed(window: Window): Promise<void> {
    if (!this.workspaceWindow || this.workspaceWindow.win !== window) {
      return;
    }

    await this.persistWindowState();
    this.detachGeometryListeners();
    this.leaf = null;
    this.workspaceWindow = null;
    this.browserWindow = null;
  }

  public async persistWindowState(): Promise<void> {
    const settings = this.persistence.getSettings();
    const patch: Partial<DailyFloatingNoteSettings> = {};

    if (settings.rememberPinState && this.browserWindow?.isAlwaysOnTop) {
      patch.lastPinState = Boolean(this.browserWindow.isAlwaysOnTop());
    }

    if (settings.rememberWindowBounds && this.browserWindow?.getBounds) {
      const bounds = this.browserWindow.getBounds();
      patch.lastBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }

    if (Object.keys(patch).length > 0) {
      await this.persistence.saveSettingsPatch(patch);
    }
  }

  public destroy(): void {
    this.detachGeometryListeners();
    this.leaf = null;
    this.workspaceWindow = null;
    this.browserWindow = null;
  }

  private createPopoutLeaf(): WorkspaceLeaf {
    const settings = this.persistence.getSettings();
    const data = settings.rememberWindowBounds && settings.lastBounds
      ? {
          x: settings.lastBounds.x,
          y: settings.lastBounds.y,
          size: {
            width: settings.lastBounds.width,
            height: settings.lastBounds.height,
          },
        }
      : undefined;

    return this.app.workspace.openPopoutLeaf(data);
  }

  private async applyOpenMode(mode: OpenMode): Promise<void> {
    if (!this.leaf) {
      return;
    }

    const state = this.leaf.getViewState();
    const markdownState = state.state as Record<string, unknown>;
    markdownState.mode = mode === 'editing' ? 'source' : 'preview';
    await this.leaf.setViewState(state, { focus: true });
  }

  private isLeafDisposed(leaf: WorkspaceLeaf): boolean {
    return !leaf.parent;
  }

  private findWorkspaceWindow(leaf: WorkspaceLeaf): WorkspaceWindow | null {
    let node: any = leaf;
    while (node) {
      if (node instanceof WorkspaceWindow) {
        return node;
      }
      if (node.win && node.doc) {
        return node as WorkspaceWindow;
      }
      node = node.parent;
    }
    return null;
  }

  private resolveBrowserWindow(domWindow: Window | null): any | null {
    if (!domWindow) {
      return null;
    }

    const winAny = domWindow as any;
    try {
      const req = winAny.require;
      if (!req) {
        return null;
      }

      try {
        const remote = req('@electron/remote');
        if (remote?.getCurrentWindow) {
          return remote.getCurrentWindow();
        }
      } catch {
        // Continue fallback.
      }

      const electron = req('electron');
      if (electron?.remote?.getCurrentWindow) {
        return electron.remote.getCurrentWindow();
      }

      return null;
    } catch {
      return null;
    }
  }

  private attachGeometryListeners(): void {
    this.detachGeometryListeners();

    const settings = this.persistence.getSettings();
    if (!settings.rememberWindowBounds || !this.browserWindow?.on) {
      return;
    }

    this.geometryHandler = () => {
      if (this.geometrySaveTimer !== null) {
        window.clearTimeout(this.geometrySaveTimer);
      }
      this.geometrySaveTimer = window.setTimeout(() => {
        void this.persistWindowState();
        this.geometrySaveTimer = null;
      }, 250);
    };

    this.browserWindow.on('resize', this.geometryHandler);
    this.browserWindow.on('move', this.geometryHandler);
  }

  private detachGeometryListeners(): void {
    if (this.geometrySaveTimer !== null) {
      window.clearTimeout(this.geometrySaveTimer);
      this.geometrySaveTimer = null;
    }

    if (this.browserWindow && this.geometryHandler) {
      this.browserWindow.removeListener?.('resize', this.geometryHandler);
      this.browserWindow.removeListener?.('move', this.geometryHandler);
    }

    this.geometryHandler = null;
  }
}
