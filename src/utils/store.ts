import { Device, DeviceType, Product, Expense, LoggedSession, Settings, ShiftState } from "../types";

export const DEFAULT_DEVICES: Device[] = [
  { id: "PS4-1", name: "بلايستيشن 1", type: DeviceType.PLAYSTATION, status: "available", activeSession: null },
  { id: "PS4-2", name: "بلايستيشن 2", type: DeviceType.PLAYSTATION, status: "available", activeSession: null },
  { id: "PS4-3", name: "بلايستيشن 3", type: DeviceType.PLAYSTATION, status: "available", activeSession: null },
  { id: "PS4-4", name: "بلايستيشن 4", type: DeviceType.PLAYSTATION, status: "available", activeSession: null },
  { id: "PC-1", name: "كومبيوتر 1", type: DeviceType.PC, status: "available", activeSession: null },
  { id: "PC-2", name: "كومبيوتر 2", type: DeviceType.PC, status: "available", activeSession: null },
  { id: "PC-3", name: "كومبيوتر 3", type: DeviceType.PC, status: "available", activeSession: null },
  { id: "PC-4", name: "كومبيوتر 4", type: DeviceType.PC, status: "available", activeSession: null },
];

export const DEFAULT_PRODUCTS: Product[] = [
  { id: "p1", name: "بيبسي / كولا", buyPrice: 0.25, sellPrice: 0.5, currentStock: 25, minStockThreshold: 5 },
  { id: "p2", name: "ماء معدني", buyPrice: 0.1, sellPrice: 0.25, currentStock: 40, minStockThreshold: 10 },
  { id: "p3", name: "بطاطا شيبس", buyPrice: 0.15, sellPrice: 0.35, currentStock: 30, minStockThreshold: 8 },
  { id: "p4", name: "قهوة إسبريسو", buyPrice: 0.2, sellPrice: 0.75, currentStock: 50, minStockThreshold: 5 },
  { id: "p5", name: "شوكولاتة سنيكرز", buyPrice: 0.3, sellPrice: 0.6, currentStock: 15, minStockThreshold: 4 },
];

export const DEFAULT_SETTINGS: Settings = {
  ps4Rate1_2: 2.0, // 2 JD / hour
  ps4Rate3: 3.0,   // 3 JD / hour
  ps4Rate4: 4.0,   // 4 JD / hour
  pcRate1: 1.5,    // 1.5 JD / hour
  pcRate2: 2.0,    // 2 JD / hour
  pcRate3_4: 3.0,  // 3 JD / hour
  soundAlertName: "retro_arcade",
  soundEnabled: true,
  soundVolume: 0.8,
  
  // Default offers configurations
  ps4OffersEnabled: false,
  ps4OffersStart: "12:00",
  ps4OffersEnd: "17:00",
  ps4OffersRate1_2: 1.5,
  ps4OffersRate3: 2.5,
  ps4OffersRate4: 3.5,

  pcOffersEnabled: false,
  pcOffersStart: "12:00",
  pcOffersEnd: "17:00",
  pcOffersRate1: 1.0,
  pcOffersRate2: 1.5,
  pcOffersRate3_4: 2.5,

  darkMode: false,
};

// Return today's date formatted as YYYY-MM-DD in the local timezone
export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface AppState {
  devices: Device[];
  products: Product[];
  expenses: Expense[];
  logs: LoggedSession[];
  settings: Settings;
  shift: ShiftState;
}

export function loadAppState(): AppState {
  try {
    const devicesRaw = localStorage.getItem("cyber_devices");
    const productsRaw = localStorage.getItem("cyber_products");
    const expensesRaw = localStorage.getItem("cyber_expenses");
    const logsRaw = localStorage.getItem("cyber_logs");
    const settingsRaw = localStorage.getItem("cyber_settings");
    const shiftRaw = localStorage.getItem("cyber_shift");

    return {
      devices: devicesRaw ? JSON.parse(devicesRaw) : DEFAULT_DEVICES,
      products: productsRaw ? JSON.parse(productsRaw) : DEFAULT_PRODUCTS,
      expenses: expensesRaw ? JSON.parse(expensesRaw) : [],
      logs: logsRaw ? JSON.parse(logsRaw) : [],
      settings: settingsRaw ? JSON.parse(settingsRaw) : DEFAULT_SETTINGS,
      shift: shiftRaw ? JSON.parse(shiftRaw) : { currentDate: getLocalDateString(), isOpen: true },
    };
  } catch (err) {
    console.error("Failed to load state from localStorage:", err);
    return {
      devices: DEFAULT_DEVICES,
      products: DEFAULT_PRODUCTS,
      expenses: [],
      logs: [],
      settings: DEFAULT_SETTINGS,
      shift: { currentDate: getLocalDateString(), isOpen: true },
    };
  }
}

export function saveAppState(state: AppState) {
  try {
    localStorage.setItem("cyber_devices", JSON.stringify(state.devices));
    localStorage.setItem("cyber_products", JSON.stringify(state.products));
    localStorage.setItem("cyber_expenses", JSON.stringify(state.expenses));
    localStorage.setItem("cyber_logs", JSON.stringify(state.logs));
    localStorage.setItem("cyber_settings", JSON.stringify(state.settings));
    localStorage.setItem("cyber_shift", JSON.stringify(state.shift));
  } catch (err) {
    console.error("Failed to save state to localStorage:", err);
  }
}

/**
 * Exports all data to a JSON string that can be downloaded
 */
export function exportBackup(state: AppState): string {
  const backupData = {
    version: "1.0.0",
    exportTimestamp: Date.now(),
    data: state
  };
  return JSON.stringify(backupData, null, 2);
}

/**
 * Validates and imports backup data
 */
export function importBackup(jsonString: string): AppState | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && parsed.data && Array.isArray(parsed.data.devices) && Array.isArray(parsed.data.products)) {
      return parsed.data as AppState;
    }
  } catch (e) {
    console.error("Invalid backup file structure", e);
  }
  return null;
}
