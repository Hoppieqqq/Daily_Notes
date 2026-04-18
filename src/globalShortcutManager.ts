type ShortcutCallback = () => void | Promise<void>;

export class GlobalShortcutManager {
  private globalShortcut: any | null = null;
  private readonly accelerator: string;
  private registered = false;

  constructor(accelerator: string, private readonly onTrigger: ShortcutCallback) {
    this.accelerator = accelerator;
  }

  public register(): boolean {
    const globalShortcut = this.resolveGlobalShortcut();
    if (!globalShortcut?.register) {
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
    if (!this.globalShortcut?.unregister) {
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
    if (this.globalShortcut?.isRegistered) {
      try {
        return Boolean(this.globalShortcut.isRegistered(this.accelerator));
      } catch {
        return this.registered;
      }
    }
    return this.registered;
  }

  private resolveGlobalShortcut(): any | null {
    const globalWindow = window as Window & { require?: (module: string) => any };
    if (typeof globalWindow.require !== 'function') {
      return null;
    }

    try {
      const remote = globalWindow.require('@electron/remote');
      const electronMain = remote?.require?.('electron');
      if (electronMain?.globalShortcut) {
        return electronMain.globalShortcut;
      }
    } catch {
      // Fall through to legacy remote.
    }

    try {
      const electron = globalWindow.require('electron');
      if (electron?.remote?.globalShortcut) {
        return electron.remote.globalShortcut;
      }
    } catch {
      return null;
    }

    return null;
  }
}
