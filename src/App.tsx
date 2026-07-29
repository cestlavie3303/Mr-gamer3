import React, { useState, useEffect, useRef } from "react";
import { 
  Device, 
  Product, 
  Expense, 
  LoggedSession, 
  Settings, 
  ShiftState, 
  DeviceType, 
  SessionType, 
  PlaySegment,
  ActiveSession
} from "./types";
import { 
  loadAppState, 
  saveAppState, 
  getLocalDateString, 
  DEFAULT_DEVICES, 
  DEFAULT_PRODUCTS, 
  DEFAULT_SETTINGS 
} from "./utils/store";
import { 
  playAlertTone, 
  getHourlyRate, 
  calculateActivePlaytimeMs, 
  formatCurrency 
} from "./utils/calculations";
import {
  scheduleSessionEndNotification,
  cancelSessionEndNotification,
  requestNotificationPermission,
  ensureBackgroundNotificationPermissions,
  ensureSessionEndChannels
} from "./utils/notifications";
import { syncActiveDevicesToNative } from "./utils/nativeService";

// Import custom view modules
import DashboardView from "./components/DashboardView";
import LogsView from "./components/LogsView";
import ExpensesView from "./components/ExpensesView";
import ReportsView from "./components/ReportsView";
import SettingsView from "./components/SettingsView";

// Icons
import { 
  Gamepad, 
  History, 
  Package, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Clock, 
  Users, 
  AlertCircle 
} from "lucide-react";

// Helper to safely check, request, and display HTML5 native notifications inside sandbox/iframes without raising uncaught "Illegal constructor" errors
const safeNotification = {
  isSupported: (): boolean => {
    try {
      if (!("Notification" in window)) return false;
      const n = window.Notification;
      if (!n) return false;
      // Accessing permission or other properties might throw in restrictive contexts
      const p = n.permission;
      return typeof n.requestPermission === "function";
    } catch (e) {
      return false;
    }
  },
  requestPermission: () => {
    try {
      if (!safeNotification.isSupported()) return;
      const n = window.Notification;
      if (n.permission === "default") {
        const req = n.requestPermission();
        if (req && typeof req.catch === "function") {
          req.catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Failed to request notification permission:", e);
    }
  },
  show: (title: string, options?: any) => {
    try {
      if (!safeNotification.isSupported()) return;
      const n = window.Notification;
      if (n.permission === "granted") {
        new n(title, options);
      }
    } catch (e) {
      console.warn("Failed to trigger native notification:", e);
    }
  }
};

export default function App() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs" | "expenses" | "reports" | "settings">("dashboard");

  // Core Application States loaded from localStorage
  const [devices, setDevices] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [logs, setLogs] = useState<LoggedSession[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [shift, setShift] = useState<ShiftState>({ currentDate: getLocalDateString(), isOpen: true });

  // Clock
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  // Sound triggering map to avoid beep overload
  const lastBeepTimestamp = useRef<{ [deviceId: string]: number }>({});

  // 1. Initialize State
  useEffect(() => {
    const loaded = loadAppState();
    setDevices(loaded.devices);
    setProducts(loaded.products);
    setExpenses(loaded.expenses);
    setLogs(loaded.logs);

    // اتبع وضع النظام (ليلي/نهاري) تلقائياً طالما المستخدم لم يختر وضعاً يدوياً من قبل
    const hasManualDarkModeChoice = localStorage.getItem("mrgamer_dark_mode_manual") === "1";
    if (!hasManualDarkModeChoice && loaded.settings) {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      loaded.settings = { ...loaded.settings, darkMode: systemPrefersDark };
    }
    setSettings(loaded.settings);
    setShift(loaded.shift);

    // Request HTML5 browser notification permission safely
    safeNotification.requestPermission();
    
    // Request Android native notification permission safely
    requestNotificationPermission();

    // Ensure exact-alarm + battery-optimization permissions so session-end
    // notifications actually fire while the app is backgrounded/locked
    ensureBackgroundNotificationPermissions();

    // Create the native notification channels for each sound preset
    ensureSessionEndChannels();

    // Live clock
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // 2. Save state whenever it changes
  useEffect(() => {
    if (devices.length > 0 || products.length > 0) {
      saveAppState({
        devices,
        products,
        expenses,
        logs,
        settings,
        shift
      });
    }
  }, [devices, products, expenses, logs, settings, shift]);

  // 2.5 Toggle Dark Mode class on HTML document based on settings
  useEffect(() => {
    if (settings && settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings?.darkMode]);

  // 2.6 Live-follow the device's system theme changes (only if the user hasn't manually overridden it)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const hasManualDarkModeChoice = localStorage.getItem("mrgamer_dark_mode_manual") === "1";
      if (!hasManualDarkModeChoice) {
        setSettings(prev => prev ? { ...prev, darkMode: e.matches } : prev);
      }
    };
    mq.addEventListener("change", handleSystemThemeChange);
    return () => mq.removeEventListener("change", handleSystemThemeChange);
  }, []);

  // 2.65 Instantly apply + persist a manual dark mode choice (bypasses the Settings "Save" button)
  const handleToggleDarkMode = (value: boolean) => {
    localStorage.setItem("mrgamer_dark_mode_manual", "1");
    setSettings(prev => prev ? { ...prev, darkMode: value } : prev);
  };

  // 2.7 Sync active devices to native Android foreground notification service
  useEffect(() => {
    if (devices.length > 0) {
      syncActiveDevicesToNative(devices, settings);
    }
  }, [devices, settings]);

  // 3. Main Running Game-Loop Tick (Runs every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let stateChanged = false;

      const updatedDevices = devices.map((device) => {
        if ((device.status === "active" || device.status === "paused") && device.activeSession) {
          stateChanged = true;
          const session = device.activeSession;

          // If the session is running (not paused), we increment the playtime of the last segment
          let updatedSegments = [...session.segments];
          if (!session.isPaused) {
            const lastSegmentIdx = updatedSegments.length - 1;
            const lastSeg = { ...updatedSegments[lastSegmentIdx] };
            const elapsed = now - session.lastTickTimestamp;

            if (elapsed > 0) {
              lastSeg.accumulatedMs += elapsed;
              updatedSegments[lastSegmentIdx] = lastSeg;
            }
          }

          // Check if session has a time limit and has ended
          if (session.selectedDurationMinutes > 0) {
            const targetMs = session.selectedDurationMinutes * 60 * 1000;
            const currentMs = updatedSegments.reduce((sum, seg) => sum + seg.accumulatedMs, 0);

            if (currentMs >= targetMs) {
              // Time is Up! Play warning sound at interval (every 12 seconds)
              const lastBeep = lastBeepTimestamp.current[device.id] || 0;
              if (now - lastBeep > 12000) {
                if (settings.soundEnabled) {
                  playAlertTone(settings.soundAlertName, settings.soundVolume);
                }

                // Native notification alert - fully wrapped to prevent uncaught "Illegal constructor"
                safeNotification.show(`انتهى الوقت! - ${device.name}`, {
                  body: `انتهى الوقت المحدد للجلسة الخاصة بالزبون ${session.customerName} على ${device.name}`,
                  silent: false
                });
                lastBeepTimestamp.current[device.id] = now;
              }
            }
          }

          return {
            ...device,
            activeSession: {
              ...session,
              segments: updatedSegments,
              lastTickTimestamp: now
            }
          };
        }
        return device;
      });

      if (stateChanged) {
        setDevices(updatedDevices);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [devices, settings]);

  // Operational state modifiers

  // A. Start play session
  const handleStartSession = (deviceId: string, sessionData: any) => {
    const dev = devices.find(d => d.id === deviceId);
    const rate = getHourlyRate(
      dev?.type || DeviceType.PLAYSTATION,
      sessionData.initialPlayersCount,
      settings
    );

    const initialSegment: PlaySegment = {
      playersCount: sessionData.initialPlayersCount,
      ratePerHour: rate,
      accumulatedMs: 0
    };

    const newActiveSession: ActiveSession = {
      deviceId,
      customerName: sessionData.customerName,
      sessionType: sessionData.sessionType,
      selectedDurationMinutes: sessionData.selectedDurationMinutes,
      targetAmount: sessionData.targetAmount,
      isPlayPrepaid: sessionData.isPlayPrepaid,
      isProductsPrepaid: false,
      segments: [initialSegment],
      addedProducts: [],
      startTime: Date.now(),
      isPaused: false,
      lastTickTimestamp: Date.now()
    };

    setDevices(prev => prev.map(d => {
      if (d.id === deviceId) {
        return {
          ...d,
          status: "active",
          activeSession: newActiveSession
        };
      }
      return d;
    }));

    // Schedule Android Notification if duration is set
    if (sessionData.selectedDurationMinutes > 0 && dev) {
      scheduleSessionEndNotification(deviceId, dev.name, sessionData.selectedDurationMinutes, settings.soundAlertName);
    }
  };

  // B. Pause session
  const handlePauseSession = (deviceId: string) => {
    const now = Date.now();
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        let updatedSegments = [...session.segments];
        const lastIdx = updatedSegments.length - 1;
        const lastSeg = { ...updatedSegments[lastIdx] };
        
        // Add running ms since last update to segment accumulatedMs
        const elapsed = now - session.lastTickTimestamp;
        if (elapsed > 0) {
          lastSeg.accumulatedMs += elapsed;
          updatedSegments[lastIdx] = lastSeg;
        }

        return {
          ...d,
          status: "paused",
          activeSession: {
            ...session,
            segments: updatedSegments,
            isPaused: true,
            lastTickTimestamp: now
          }
        };
      }
      return d;
    }));

    // Cancel Android Notification when paused
    cancelSessionEndNotification(deviceId);
  };

  // C. Resume session
  const handleResumeSession = (deviceId: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        return {
          ...d,
          status: "active",
          activeSession: {
            ...d.activeSession,
            isPaused: false,
            lastTickTimestamp: Date.now()
          }
        };
      }
      return d;
    }));

    // Reschedule Android Notification with remaining minutes
    const dev = devices.find(d => d.id === deviceId);
    if (dev && dev.activeSession && dev.activeSession.selectedDurationMinutes > 0) {
      const session = dev.activeSession;
      const targetMs = session.selectedDurationMinutes * 60 * 1000;
      const currentMs = session.segments.reduce((sum, seg) => sum + seg.accumulatedMs, 0);
      const remainingMinutes = Math.max(0, (targetMs - currentMs) / (60 * 1000));
      scheduleSessionEndNotification(deviceId, dev.name, remainingMinutes, settings.soundAlertName);
    }
  };

  // D. Change active player count on the fly (Without retroactivity!)
  const handleChangePlayers = (deviceId: string, count: number) => {
    const now = Date.now();
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        let updatedSegments = [...session.segments];
        const lastIdx = updatedSegments.length - 1;
        const lastSeg = { ...updatedSegments[lastIdx] };

        // Save accumulated active time on current running segment
        if (!session.isPaused) {
          const elapsed = now - session.lastTickTimestamp;
          if (elapsed > 0) {
            lastSeg.accumulatedMs += elapsed;
            updatedSegments[lastIdx] = lastSeg;
          }
        }

        // Create new segment for future playtime at the new player count rate
        const newRate = getHourlyRate(d.type, count, settings);
        const newSegment: PlaySegment = {
          playersCount: count,
          ratePerHour: newRate,
          accumulatedMs: 0
        };

        updatedSegments.push(newSegment);

        return {
          ...d,
          activeSession: {
            ...session,
            segments: updatedSegments,
            lastTickTimestamp: now
          }
        };
      }
      return d;
    }));
  };

  // E. Add product to session (Decreases inventory stock)
  const handleAddProductToSession = (deviceId: string, productId: string, quantity: number) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct || targetProduct.currentStock < quantity) return;

    // Decrement product stock
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, currentStock: p.currentStock - quantity };
      }
      return p;
    }));

    // Add to session
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        let updatedAdded = [...session.addedProducts];
        const existingIdx = updatedAdded.findIndex(item => item.productId === productId);

        if (existingIdx > -1) {
          const item = { ...updatedAdded[existingIdx] };
          item.quantity += quantity;
          updatedAdded[existingIdx] = item;
        } else {
          updatedAdded.push({
            productId,
            name: targetProduct.name,
            quantity,
            sellPrice: targetProduct.sellPrice,
            buyPrice: targetProduct.buyPrice,
            addedTime: Date.now(),
            isPrepaid: false
          });
        }

        return {
          ...d,
          activeSession: {
            ...session,
            addedProducts: updatedAdded
          }
        };
      }
      return d;
    }));
  };

  // F. Delete product from session (Restores stock to inventory)
  const handleRemoveProductFromSession = (deviceId: string, productId: string) => {
    let quantityToRestore = 0;

    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        const item = session.addedProducts.find(x => x.productId === productId);
        if (item) {
          quantityToRestore = item.quantity;
        }

        return {
          ...d,
          activeSession: {
            ...session,
            addedProducts: session.addedProducts.filter(x => x.productId !== productId)
          }
        };
      }
      return d;
    }));

    if (quantityToRestore > 0) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return { ...p, currentStock: p.currentStock + quantityToRestore };
        }
        return p;
      }));
    }
  };

  // F2. Decrement quantity of an already-added product by 1 (removes it entirely once it reaches 0), restoring 1 unit of stock
  const handleDecrementProductInSession = (deviceId: string, productId: string) => {
    let stockToRestore = 0;

    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        const idx = session.addedProducts.findIndex(x => x.productId === productId);
        if (idx === -1) return d;

        const item = session.addedProducts[idx];
        let updatedAdded;
        if (item.quantity > 1) {
          updatedAdded = [...session.addedProducts];
          updatedAdded[idx] = { ...item, quantity: item.quantity - 1 };
        } else {
          updatedAdded = session.addedProducts.filter(x => x.productId !== productId);
        }
        stockToRestore = 1;

        return {
          ...d,
          activeSession: {
            ...session,
            addedProducts: updatedAdded
          }
        };
      }
      return d;
    }));

    if (stockToRestore > 0) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return { ...p, currentStock: p.currentStock + stockToRestore };
        }
        return p;
      }));
    }
  };

  // G. Toggle prepaid play
  const handleTogglePlayPrepaid = (deviceId: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        return {
          ...d,
          activeSession: {
            ...d.activeSession,
            isPlayPrepaid: !d.activeSession.isPlayPrepaid
          }
        };
      }
      return d;
    }));
  };

  // H. Toggle prepaid products
  const handleToggleProductsPrepaid = (deviceId: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        return {
          ...d,
          activeSession: {
            ...d.activeSession,
            isProductsPrepaid: !d.activeSession.isProductsPrepaid
          }
        };
      }
      return d;
    }));
  };

  // I. Extend session
  const handleExtendSession = (deviceId: string, minutes: number, openEnded?: boolean) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId && d.activeSession) {
        const session = d.activeSession;
        
        let newType = session.sessionType;
        let newDuration = session.selectedDurationMinutes;

        if (openEnded) {
          newType = SessionType.OPEN;
          newDuration = -1;
        } else {
          if (session.selectedDurationMinutes <= 0) {
            // converting open session to timed session, start duration from current elapsed + extension
            const currentElapsedMins = calculateActivePlaytimeMs(session, Date.now()) / (1000 * 60);
            newDuration = Math.round(currentElapsedMins + minutes);
            newType = SessionType.CUSTOM;
          } else {
            newDuration += minutes;
          }
        }

        return {
          ...d,
          activeSession: {
            ...session,
            sessionType: newType,
            selectedDurationMinutes: newDuration
          }
        };
      }
      return d;
    }));

    // Reschedule Android Notification for extended sessions
    const dev = devices.find(d => d.id === deviceId);
    if (dev && dev.activeSession) {
      if (openEnded) {
        cancelSessionEndNotification(deviceId);
      } else {
        const session = dev.activeSession;
        let newDuration = session.selectedDurationMinutes;
        if (session.selectedDurationMinutes <= 0) {
          const currentElapsedMins = calculateActivePlaytimeMs(session, Date.now()) / (1000 * 60);
          newDuration = Math.round(currentElapsedMins + minutes);
        } else {
          newDuration += minutes;
        }

        const targetMs = newDuration * 60 * 1000;
        const currentMs = session.segments.reduce((sum, seg) => sum + seg.accumulatedMs, 0);
        const remainingMinutes = Math.max(0, (targetMs - currentMs) / (60 * 1000));
        scheduleSessionEndNotification(deviceId, dev.name, remainingMinutes, settings.soundAlertName);
      }
    }
  };

  // J. End play session and record revenues to shift logs
  const handleEndSession = (deviceId: string) => {
    const now = Date.now();
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice || !targetDevice.activeSession) return;

    const session = targetDevice.activeSession;
    
    // Accrue last segment before closing
    let finalizedSegments = [...session.segments];
    const lastIdx = finalizedSegments.length - 1;
    const lastSeg = { ...finalizedSegments[lastIdx] };
    if (!session.isPaused) {
      const elapsed = now - session.lastTickTimestamp;
      if (elapsed > 0) {
        lastSeg.accumulatedMs += elapsed;
        finalizedSegments[lastIdx] = lastSeg;
      }
    }

    // Recalculate cost with final segment states
    const finalSessionWithSegmentAccumulated = {
      ...session,
      segments: finalizedSegments,
      isPaused: true,
      lastTickTimestamp: now
    };

    const finalPlayCost = Math.round(
      finalizedSegments.reduce((sum, seg) => {
        const hours = seg.accumulatedMs / (1000 * 60 * 60);
        return sum + (hours * seg.ratePerHour);
      }, 0) * 100
    ) / 100;

    const totalMs = finalizedSegments.reduce((sum, seg) => sum + seg.accumulatedMs, 0);
    const totalDurationMinutes = totalMs / (1000 * 60);

    const productsCost = session.addedProducts.reduce((sum, p) => sum + (p.sellPrice * p.quantity), 0);
    const grandTotal = finalPlayCost + productsCost;

    const segmentSummaries = finalizedSegments.map(seg => ({
      playersCount: seg.playersCount,
      minutes: seg.accumulatedMs / (1000 * 60),
      cost: (seg.accumulatedMs / (1000 * 60 * 60)) * seg.ratePerHour
    }));

    const productsSummary = session.addedProducts.map(p => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      sellPrice: p.sellPrice,
      isPrepaid: p.isPrepaid || session.isProductsPrepaid
    }));

    // Write log
    const newLoggedSession: LoggedSession = {
      id: `log-${Date.now()}`,
      deviceId,
      deviceName: targetDevice.name,
      deviceType: targetDevice.type,
      customerName: session.customerName,
      startTime: session.startTime,
      endTime: now,
      totalDurationMinutes,
      playCost: finalPlayCost,
      isPlayPrepaid: session.isPlayPrepaid,
      isProductsPrepaid: session.isProductsPrepaid,
      productsCost,
      grandTotal,
      playersHistory: segmentSummaries,
      products: productsSummary,
      shiftDate: shift.currentDate // Saves strictly on the active shift date!
    };

    setLogs(prev => [newLoggedSession, ...prev]);

    // Free device
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId) {
        return {
          ...d,
          status: "available",
          activeSession: null
        };
      }
      return d;
    }));

    // Clear alert triggers
    delete lastBeepTimestamp.current[deviceId];

    // Cancel Android local notification
    cancelSessionEndNotification(deviceId);
  };

  // K. Cancel active session (accidental start) - returns products stock, resets device
  const handleCancelSession = (deviceId: string) => {
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice || !targetDevice.activeSession) return;

    const session = targetDevice.activeSession;

    // Restore any product stock back to inventory
    if (session.addedProducts.length > 0) {
      setProducts(prev => prev.map(p => {
        const addedItem = session.addedProducts.find(x => x.productId === p.id);
        if (addedItem) {
          return { ...p, currentStock: p.currentStock + addedItem.quantity };
        }
        return p;
      }));
    }

    // Reset device
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId) {
        return {
          ...d,
          status: "available",
          activeSession: null
        };
      }
      return d;
    }));

    delete lastBeepTimestamp.current[deviceId];

    // Cancel Android local notification
    cancelSessionEndNotification(deviceId);
  };

  // L. End Shift / End Day with Password Protection
  const handleEndDay = (password: string): boolean => {
    if (password !== "0000") return false;

    // Check if any devices are busy
    const activeDevices = devices.filter(d => d.status !== "available");
    if (activeDevices.length > 0) return false; // all devices must be checked out!

    // Increment shift date by 1 day to start fresh
    const activeDate = new Date(shift.currentDate);
    activeDate.setDate(activeDate.getDate() + 1);
    
    const year = activeDate.getFullYear();
    const month = String(activeDate.getMonth() + 1).padStart(2, "0");
    const day = String(activeDate.getDate()).padStart(2, "0");
    const nextShiftDate = `${year}-${month}-${day}`;

    setShift({
      currentDate: nextShiftDate,
      isOpen: true
    });

    return true;
  };

  // M. Direct sale of snack/beverage (decrements stock and writes to history/revenues)
  const handleDirectSale = (productId: string, quantity: number): boolean => {
    const targetProd = products.find(p => p.id === productId);
    if (!targetProd || targetProd.currentStock < quantity) return false;

    // Decrement stock
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, currentStock: p.currentStock - quantity };
      }
      return p;
    }));

    // Register Direct Sale log
    const productsCost = targetProd.sellPrice * quantity;
    const directSaleLog: LoggedSession = {
      id: `sale-${Date.now()}`,
      deviceId: "DIRECT_SALE",
      deviceName: "بيع مباشر (كاش)",
      deviceType: DeviceType.PC, // mock type
      customerName: "زبون خارجي",
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      totalDurationMinutes: 1,
      playCost: 0,
      isPlayPrepaid: true,
      isProductsPrepaid: true,
      productsCost,
      grandTotal: productsCost,
      playersHistory: [],
      products: [{
        productId,
        name: targetProd.name,
        quantity,
        sellPrice: targetProd.sellPrice,
        isPrepaid: true
      }],
      shiftDate: shift.currentDate // saves under shift date
    };

    setLogs(prev => [directSaleLog, ...prev]);
    return true;
  };

  // N. Restock product: increases stock AND automatically records a purchases expense record
  const handleRestockProduct = (productId: string, quantity: number, customBuyPrice?: number) => {
    const targetProd = products.find(p => p.id === productId);
    if (!targetProd) return;

    const finalBuyPrice = customBuyPrice !== undefined ? customBuyPrice : targetProd.buyPrice;
    const totalBill = finalBuyPrice * quantity;

    // Increase product stock & optionally update buyPrice
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { 
          ...p, 
          currentStock: p.currentStock + quantity,
          buyPrice: finalBuyPrice
        };
      }
      return p;
    }));

    // Register purchases expense
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      category: "purchases",
      description: `توريد مستودع: شراء منتج (${targetProd.name}) عدد ${quantity}`,
      amount: totalBill,
      date: shift.currentDate,
      timestamp: Date.now()
    };

    setExpenses(prev => [newExpense, ...prev]);
  };

  // O. Add custom direct expense (rent, electricity, repairs)
  const handleAddExpense = (expenseData: Omit<Expense, "id" | "timestamp">) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      timestamp: Date.now()
    };
    setExpenses(prev => [newExpense, ...prev]);
  };

  // P. Save custom configurations
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  // Q. Overwrite full database from imported backup
  const handleImportState = (imported: any) => {
    if (imported.devices) setDevices(imported.devices);
    if (imported.products) setProducts(imported.products);
    if (imported.expenses) setExpenses(imported.expenses);
    if (imported.logs) setLogs(imported.logs);
    if (imported.settings) setSettings(imported.settings);
    if (imported.shift) setShift(imported.shift);
  };

  // Low Stock products badge counter
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockThreshold).length;

  // Active playing devices count badge
  const activeDevicesCount = devices.filter(d => d.status !== "available").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white antialiased">
      
      {/* Top Banner Header */}
      <header className="bg-gray-900 text-white shadow-md border-b border-gray-800 shrink-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between" dir="rtl">
          
          {/* Logo badge */}
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-600/10">
              <Gamepad className="w-4 h-4 animate-pulse" />
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight leading-tight">Mr.Gamer</h1>
              <p className="text-[9px] text-gray-400 font-medium font-sans">نظام الصالة المتكامل</p>
            </div>
          </div>

          {/* Clock & active date */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 text-amber-400 font-black">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {currentTimeStr || "00:00:00"}
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-3 pb-20">
        {activeTab === "dashboard" && (
          <DashboardView
            devices={devices}
            products={products}
            settings={settings}
            shiftDate={shift.currentDate}
            onStartSession={handleStartSession}
            onPauseSession={handlePauseSession}
            onResumeSession={handleResumeSession}
            onChangePlayers={handleChangePlayers}
            onAddProductToSession={handleAddProductToSession}
            onRemoveProductFromSession={handleRemoveProductFromSession}
            onDecrementProductInSession={handleDecrementProductInSession}
            onTogglePlayPrepaid={handleTogglePlayPrepaid}
            onToggleProductsPrepaid={handleToggleProductsPrepaid}
            onExtendSession={handleExtendSession}
            onEndSession={handleEndSession}
            onCancelSession={handleCancelSession}
            onEndDay={handleEndDay}
          />
        )}

        {activeTab === "logs" && (
          <LogsView
            logs={logs}
            expenses={expenses}
            shiftDate={shift.currentDate}
          />
        )}

        {activeTab === "expenses" && (
          <ExpensesView
            products={products}
            expenses={expenses}
            shiftDate={shift.currentDate}
            onAddProduct={(p) => setProducts(prev => [...prev, { ...p, id: `p-${Date.now()}` }])}
            onEditProduct={(id, edits) => setProducts(prev => prev.map(p => p.id === id ? { ...p, ...edits } : p))}
            onDeleteProduct={(id) => setProducts(prev => prev.filter(p => p.id !== id))}
            onRestockProduct={handleRestockProduct}
            onDirectSale={handleDirectSale}
            onAddExpense={handleAddExpense}
          />
        )}

        {activeTab === "reports" && (
          <ReportsView
            logs={logs}
            expenses={expenses}
            shiftDate={shift.currentDate}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            fullState={{ devices, products, expenses, logs, settings, shift }}
            onImportState={handleImportState}
          />
        )}
      </main>

      {/* Floating Bottom Navigation Tabbar (Perfect for Android Phone & Desktop layout) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 shadow-2xl py-2 px-4 z-40">
        <div className="max-w-xl mx-auto flex justify-between items-center" dir="rtl">
          
          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition cursor-pointer relative ${
              activeTab === "dashboard" ? "text-indigo-600 bg-indigo-50 font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Gamepad className="w-5 h-5 shrink-0" />
            <span className="text-[10px]">الأجهزة</span>
            {activeDevicesCount > 0 && (
              <span className="absolute -top-1 right-2.5 bg-indigo-600 text-white text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-bounce">
                {activeDevicesCount}
              </span>
            )}
          </button>

          {/* Logs Tab */}
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition cursor-pointer ${
              activeTab === "logs" ? "text-indigo-600 bg-indigo-50 font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <History className="w-5 h-5 shrink-0" />
            <span className="text-[10px]">السجلات</span>
          </button>

          {/* Storage Warehouse & Expenses Tab */}
          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition cursor-pointer relative ${
              activeTab === "expenses" ? "text-indigo-600 bg-indigo-50 font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Package className="w-5 h-5 shrink-0" />
            <span className="text-[10px]">المخزن والمصروفات</span>
            {lowStockCount > 0 && (
              <span className="absolute -top-1 right-2.5 bg-rose-600 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {lowStockCount}
              </span>
            )}
          </button>

          {/* Reports Tab */}
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition cursor-pointer ${
              activeTab === "reports" ? "text-indigo-600 bg-indigo-50 font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <TrendingUp className="w-5 h-5 shrink-0" />
            <span className="text-[10px]">التقارير المالية</span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition cursor-pointer ${
              activeTab === "settings" ? "text-indigo-600 bg-indigo-50 font-bold" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            <span className="text-[10px]">الإعدادات</span>
          </button>

        </div>
      </nav>

    </div>
  );
}
