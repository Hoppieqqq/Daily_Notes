export type DailySource = 'core-daily-notes' | 'periodic-notes' | 'plugin-custom';
export type RepeatHotkeyBehavior = 'focus' | 'toggle-visibility' | 'reopen';
export type OpenMode = 'editing' | 'reading';

export interface FloatingWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DailyFloatingNoteSettings {
  pinByDefault: boolean;
  rememberPinState: boolean;
  rememberWindowBounds: boolean;
  dailySource: DailySource;
  customFolder: string;
  customDateFormat: string;
  customTemplatePath: string;
  repeatHotkeyBehavior: RepeatHotkeyBehavior;
  openMode: OpenMode;
  lastPinState: boolean;
  lastBounds: FloatingWindowBounds | null;
}

export const DEFAULT_SETTINGS: DailyFloatingNoteSettings = {
  pinByDefault: true,
  rememberPinState: true,
  rememberWindowBounds: true,
  dailySource: 'core-daily-notes',
  customFolder: 'Daily',
  customDateFormat: 'YYYY-MM-DD',
  customTemplatePath: '',
  repeatHotkeyBehavior: 'focus',
  openMode: 'editing',
  lastPinState: true,
  lastBounds: null,
};

export const COMMAND_IDS = {
  OPEN_TODAY: 'open-floating-daily-today',
  OPEN_YESTERDAY: 'open-floating-daily-yesterday',
  OPEN_TOMORROW: 'open-floating-daily-tomorrow',
  TOGGLE_PIN: 'toggle-floating-daily-pin',
  CLOSE_WINDOW: 'close-floating-daily-window',
} as const;
