import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

export type SyncStatus =
  | "advertising"
  | "endpointFound"
  | "connecting"
  | "connected"
  | "sending"
  | "sent"
  | "received"
  | "disconnected"
  | "error";

export interface SyncStatusEvent {
  status: SyncStatus;
  message: string;
}

export interface SyncDataEvent {
  data: string;
}

interface NearbySyncPluginApi {
  checkSyncPermissions(): Promise<{ granted: boolean }>;
  requestSyncPermissions(): Promise<{ granted: boolean }>;
  startSync(options: { deviceName: string; backupJson: string }): Promise<void>;
  stopSync(): Promise<void>;
  addListener(
    eventName: "statusUpdate",
    listenerFunc: (event: SyncStatusEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "dataReceived",
    listenerFunc: (event: SyncDataEvent) => void
  ): Promise<PluginListenerHandle>;
}

const NearbySync = registerPlugin<NearbySyncPluginApi>("NearbySync");

export async function ensureSyncPermissions(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const check = await NearbySync.checkSyncPermissions();
    if (check.granted) return true;
    const request = await NearbySync.requestSyncPermissions();
    return request.granted;
  } catch (error) {
    console.error("Error requesting nearby sync permissions:", error);
    return false;
  }
}

export async function startNearbySync(
  deviceName: string,
  backupJson: string,
  onStatus: (event: SyncStatusEvent) => void,
  onDataReceived: (event: SyncDataEvent) => void
): Promise<() => void> {
  const statusHandle = await NearbySync.addListener("statusUpdate", onStatus);
  const dataHandle = await NearbySync.addListener("dataReceived", onDataReceived);

  await NearbySync.startSync({ deviceName, backupJson });

  // دالة تنظيف: توقف المزامنة وتزيل المستمعين
  return async () => {
    await NearbySync.stopSync();
    statusHandle.remove();
    dataHandle.remove();
  };
}

export async function stopNearbySync(): Promise<void> {
  if (!isNative) return;
  try {
    await NearbySync.stopSync();
  } catch (error) {
    console.error("Error stopping nearby sync:", error);
  }
}
