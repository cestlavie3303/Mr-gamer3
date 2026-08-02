import { registerPlugin, Capacitor } from "@capacitor/core";
import { Device, Settings } from "../types";

// ==========================================
// 1. Native Service Plugin Logic
// ==========================================

export interface ActiveDevicesPluginInterface {
  updateActiveDevices(options: { devices: string }): Promise<void>;
  stopService(): Promise<void>;
}

const ActiveDevices = registerPlugin<ActiveDevicesPluginInterface>("ActiveDevices");

let lastSyncedJson = "";

/**
 * إرسال بيانات الأجهزة النشطة وإعدادات التنبيه الصوتي الناتيف
 * إلى خدمة الأندرويد الناتيف (Native Foreground Service)
 */
export async function syncActiveDevicesToNative(devices: Device[], settings?: Settings) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const soundAlertName = settings?.soundAlertName || "double_beep";
    const soundEnabled = settings?.soundEnabled !== false;

    const activeList = devices
      .filter((d) => (d.status === "active" || d.status === "paused") && d.activeSession)
      .map((d) => {
        const s = d.activeSession!;
        const totalAccumulatedMs = (s.segments || []).reduce(
          (acc, seg) => acc + (seg.accumulatedMs || 0),
          0
        );

        return {
          id: d.id,
          name: d.name,
          sessionType: s.sessionType,
          selectedDurationMinutes: s.selectedDurationMinutes || 0,
          accumulatedMs: totalAccumulatedMs,
          lastTickTimestamp: s.lastTickTimestamp || Date.now(),
          isPaused: s.isPaused || d.status === "paused",
          soundAlertName,
          soundEnabled
        };
      });

    const payload = JSON.stringify(activeList);
    
    if (payload === lastSyncedJson) return;
    lastSyncedJson = payload;

    if (activeList.length === 0) {
      await ActiveDevices.stopService();
    } else {
      await ActiveDevices.updateActiveDevices({
        devices: payload
      });
    }
  } catch (error) {
    console.error("Failed to sync active devices with native Android service:", error);
  }
}

// ==========================================
// 2. Direct Offline Device-to-Device Sync
// ==========================================

export interface SyncStatusEvent {
  status: "searching" | "connected" | "success" | "error";
  message: string;
}

export interface SyncDataEvent {
  data: string;
}

export async function ensureSyncPermissions(): Promise<boolean> {
  return true;
}

export async function startNearbySync(
  appName: string,
  localBackupJson: string,
  onStatusChange: (event: SyncStatusEvent) => void,
  onDataReceived: (event: SyncDataEvent) => void
): Promise<() => void> {
  let isCancelled = false;

  onStatusChange({
    status: "searching",
    message: "جاري البحث والاتصال بالجهاز القريب...",
  });

  // مؤقت أمان 12 ثانية لتجنب التعليق عند "تم العثور"
  const timeoutId = setTimeout(() => {
    if (!isCancelled) {
      onStatusChange({
        status: "error",
        message: "تأخر الاستجابة.. يرجى الضغط على زر المزامنة معاً في الجهازين.",
      });
    }
  }, 12000);

  const channelName = "mrgamer_direct_sync";
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

  if (channel) {
    try {
      channel.postMessage({ type: "SYNC_DATA_SEND", payload: localBackupJson });
    } catch (e) {
      console.error(e);
    }

    channel.onmessage = (event) => {
      if (isCancelled) return;
      if (event.data && event.data.type === "SYNC_DATA_SEND" && event.data.payload) {
        clearTimeout(timeoutId);
        onStatusChange({
          status: "connected",
          message: "تم استلام البيانات! جاري الدمج والتحديث...",
        });
        setTimeout(() => {
          if (!isCancelled) {
            onDataReceived({ data: event.data.payload });
          }
        }, 300);
      }
    };
  }

  return () => {
    isCancelled = true;
    clearTimeout(timeoutId);
    if (channel) channel.close();
  };
}

export async function stopNearbySync() {}
