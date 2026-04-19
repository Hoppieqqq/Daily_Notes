import { App, Notice, TFile, WorkspaceLeaf, WorkspaceWindow } from 'obsidian';
import { DailyFloatingNoteSettings, OpenMode } from './settings';

interface FloatingWindowPersistence {
  getSettings: () => DailyFloatingNoteSettings;
  saveSettingsPatch: (patch: Partial<DailyFloatingNoteSettings>) => Promise<void>;
}

interface BrowserWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserWindowLike {
  isMinimized?: () => boolean;
  restore?: () => void;
  show?: () => void;
  focus?: () => void;
  minimize?: () => void;
  isAlwaysOnTop?: () => boolean;
  setAlwaysOnTop?: (flag: boolean, level?: string) => void;
  getBounds?: () => BrowserWindowBounds;
  on?: (event: 'resize' | 'move', handler: () => void) => void;
  removeListener?: (event: 'resize' | 'move', handler: () => void) => void;
}

interface ElectronRemoteLike {
  getCurrentWindow?: () => BrowserWindowLike;
  require?: (module: string) => unknown;
}

interface ElectronModuleLike {
  remote?: {
    getCurrentWindow?: () => BrowserWindowLike;
  };
}

type WindowWithRequire = Window & {
  require?: (module: string) => unknown;
};

type WorkspaceNodeLike = {
  parent?: WorkspaceNodeLike | null;
  win?: Window;
  doc?: Document;
};

type MarkdownViewState = {
  file?: string;
  mode?: 'source' | 'preview';
};

export class FloatingWindowManager {
  private leaf: WorkspaceLeaf | null = null;
  private workspaceWindow: WorkspaceWindow | null = null;
  private browserWindow: BrowserWindowLike | null = null;
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
    const markdownState = state?.state as MarkdownViewState | undefined;
    const filePath = markdownState?.file;
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
    await this.focusWindow();
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
        // Fall back to workspace reveal.
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
      new Notice('Could not change the pin state because the app window bridge is unavailable.');
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
      new Notice('Could not change the always-on-top state on this platform.');
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
    const markdownState = (state.state as MarkdownViewState | undefined) ?? {};
    markdownState.mode = mode === 'editing' ? 'source' : 'preview';
    state.state = markdownState;
    await this.leaf.setViewState(state, { focus: true });
  }

  private isLeafDisposed(leaf: WorkspaceLeaf): boolean {
    return !leaf.parent;
  }

  private findWorkspaceWindow(leaf: WorkspaceLeaf): WorkspaceWindow | null {
    let node: WorkspaceNodeLike | WorkspaceWindow | null = leaf;
    while (node) {
      if (node instanceof WorkspaceWindow) {
        return node;
      }
      if (this.isWorkspaceWindowLike(node)) {
        return node;
      }
      node = node.parent ?? null;
    }
    return null;
  }

  private resolveBrowserWindow(domWindow: Window | null): BrowserWindowLike | null {
    if (!domWindow) {
      return null;
    }

    const requireFunction = (domWindow as WindowWithRequire).require;
    if (!requireFunction) {
      return null;
    }

    try {
      const remoteModule = requireFunction('@electron/remote');
      if (this.isElectronRemoteModule(remoteModule) && remoteModule.getCurrentWindow) {
        return remoteModule.getCurrentWindow();
      }
    } catch {
      // Continue with the legacy fallback.
    }

    try {
      const electronModule = requireFunction('electron');
      if (this.isElectronModule(electronModule) && electronModule.remote?.getCurrentWindow) {
        return electronModule.remote.getCurrentWindow();
      }
    } catch {
      return null;
    }

    return null;
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

  private isElectronRemoteModule(value: unknown): value is ElectronRemoteLike {
    return typeof value === 'object' && value !== null;
  }

  private isElectronModule(value: unknown): value is ElectronModuleLike {
    return typeof value === 'object' && value !== null;
  }

  private isWorkspaceWindowLike(value: WorkspaceNodeLike | WorkspaceWindow): value is WorkspaceWindow {
    return 'win' in value && 'doc' in value && value.win instanceof Window && value.doc instanceof Document;
  }
}

