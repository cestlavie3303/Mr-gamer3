export enum DeviceType {
  PLAYSTATION = "PS4",
  PC = "PC"
}

export enum SessionType {
  HALF_HOUR = "0.5_HOUR",
  ONE_HOUR = "1_HOUR",
  TWO_HOURS = "2_HOURS",
  OPEN = "OPEN",
  CUSTOM = "CUSTOM",
  BY_AMOUNT = "BY_AMOUNT"
}

export interface PlaySegment {
  playersCount: number; // 1, 2, 3, or 4 players
  ratePerHour: number; // rate for this period
  accumulatedMs: number; // actual playtime accumulated under this segment
}

export interface ActiveSession {
  deviceId: string;
  customerName: string;
  sessionType: SessionType;
  selectedDurationMinutes: number; // 30, 60, 120, open, custom, or by amount
  targetAmount: number; // if BY_AMOUNT, how much they paid
  isPlayPrepaid: boolean;
  isProductsPrepaid: boolean;
  segments: PlaySegment[]; // active segments of play with distinct player counts
  addedProducts: {
    productId: string;
    name: string;
    quantity: number;
    sellPrice: number;
    buyPrice: number;
    addedTime: number;
    isPrepaid: boolean;
  }[];
  startTime: number; // timestamp when session was first started
  isPaused: boolean;
  lastTickTimestamp: number; // timestamp of last update
}

export interface Device {
  id: string; // e.g., PS4-1, PC-2
  name: string; // e.g., بلايستيشن 1, كومبيوتر 2
  type: DeviceType;
  status: "available" | "active" | "paused";
  activeSession: ActiveSession | null;
}

export interface Product {
  id: string;
  name: string;
  buyPrice: number; // purchase price for profit reports
  sellPrice: number; // selling price
  currentStock: number;
  minStockThreshold: number; // low stock alert
}

export interface Expense {
  id: string;
  category: "fawateer" | "purchases" | "rent" | "maintenance" | "other"; // fawateer (bills), purchases (stock), etc.
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD (Shift Date)
  timestamp: number;
}

export interface LoggedSession {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  customerName: string;
  startTime: number;
  endTime: number;
  totalDurationMinutes: number;
  playCost: number;
  isPlayPrepaid: boolean;
  isProductsPrepaid: boolean;
  productsCost: number;
  grandTotal: number;
  playersHistory: { playersCount: number; minutes: number; cost: number }[];
  products: {
    productId: string;
    name: string;
    quantity: number;
    sellPrice: number;
    isPrepaid: boolean;
  }[];
  shiftDate: string; // The business day date (Shift Date) this was closed in
}

export interface Settings {
  ps4Rate1_2: number; // PS4 rate for 1 or 2 players
  ps4Rate3: number;   // PS4 rate for 3 players
  ps4Rate4: number;   // PS4 rate for 4 players
  pcRate1: number;    // PC rate for 1 player
  pcRate2: number;    // PC rate for 2 players
  pcRate3_4: number;  // PC rate for 3-4 players
  soundAlertName: string; // name of selected alarm tone
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  
  // Offers configurations
  ps4OffersEnabled: boolean;
  ps4OffersStart: string; // "HH:MM" format
  ps4OffersEnd: string;   // "HH:MM" format
  ps4OffersRate1_2: number;
  ps4OffersRate3: number;
  ps4OffersRate4: number;

  pcOffersEnabled: boolean;
  pcOffersStart: string;  // "HH:MM" format
  pcOffersEnd: string;    // "HH:MM" format
  pcOffersRate1: number;
  pcOffersRate2: number;
  pcOffersRate3_4: number;

  darkMode: boolean;
}

export interface ShiftState {
  currentDate: string; // Business shift date (e.g., "2026-07-16")
  isOpen: boolean;
}
