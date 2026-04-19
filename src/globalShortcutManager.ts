type ShortcutCallback = () => void | Promise<void>;

interface ElectronGlobalShortcut {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
  isRegistered(accelerator: string): boolean;
}

interface ElectronRemoteModuleLike {
  require?: (module: string) => unknown;
}

interface ElectronModuleLike {
  globalShortcut?: ElectronGlobalShortcut;
  remote?: {
    globalShortcut?: ElectronGlobalShortcut;
  };
}

type RequireFunction = (module: string) => unknown;

type WindowWithRequire = Window & {
  require?: RequireFunction;
};

export class GlobalShortcutManager {
  private globalShortcut: ElectronGlobalShortcut | null = null;
  private readonly accelerator: string;
  private registered = false;

  constructor(accelerator: string, private readonly onTrigger: ShortcutCallback) {
    this.accelerator = accelerator;
  }

  public register(): boolean {
    const globalShortcut = this.resolveGlobalShortcut();
    if (!globalShortcut) {
      this.unregister();
      return false;
    }

    this.unregister();

    try {
      const success = Boolean(
        globalShortcut.register(this.accelerator, () => {
          void this.onTrigger();
        }),
      );

      this.globalShortcut = globalShortcut;
      this.registered = success;
      return success;
    } catch {
      this.globalShortcut = null;
      this.registered = false;
      return false;
    }
  }

  public unregister(): void {
    if (!this.globalShortcut) {
      this.globalShortcut = null;
      this.registered = false;
      return;
    }

    try {
      this.globalShortcut.unregister(this.accelerator);
    } catch {
      // Ignore Electron bridge errors on unload.
    }

    this.globalShortcut = null;
    this.registered = false;
  }

  public isRegistered(): boolean {
    if (this.globalShortcut) {
      try {
        return Boolean(this.globalShortcut.isRegistered(this.accelerator));
      } catch {
        return this.registered;
      }
    }
    return this.registered;
  }

  private resolveGlobalShortcut(): ElectronGlobalShortcut | null {
    const globalWindow = window as WindowWithRequire;
    if (typeof globalWindow.require !== 'function') {
      return null;
    }

    try {
      const remoteModule = globalWindow.require('@electron/remote');
      if (this.isElectronRemoteModule(remoteModule)) {
        const electronMain = remoteModule.require?.('electron');
        if (this.isElectronModule(electronMain) && electronMain.globalShortcut) {
          return electronMain.globalShortcut;
        }
      }
    } catch {
      // Fall through to legacy remote.
    }

    try {
      const electronModule = globalWindow.require('electron');
      if (this.isElectronModule(electronModule) && electronModule.remote?.globalShortcut) {
        return electronModule.remote.globalShortcut;
      }
    } catch {
      return null;
    }

    return null;
  }

  private isElectronRemoteModule(value: unknown): value is ElectronRemoteModuleLike {
    return typeof value === 'object' && value !== null;
  }

  private isElectronModule(value: unknown): value is ElectronModuleLike {
    return typeof value === 'object' && value !== null;
  }
}
