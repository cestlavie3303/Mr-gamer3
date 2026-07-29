import { registerPlugin, Capacitor } from "@capacitor/core";
import { Device, Settings } from "../types";

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
