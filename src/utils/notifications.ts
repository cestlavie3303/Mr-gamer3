import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

interface ActiveDevicesPluginApi {
  updateActiveDevices(options: { devices: string }): Promise<void>;
  stopService(): Promise<void>;
  canScheduleExactAlarms(): Promise<{ value: boolean }>;
  requestExactAlarmPermission(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  saveCustomSound(options: { base64Data: string; fileName: string }): Promise<{ success: boolean }>;
}

const ActiveDevicesNative = registerPlugin<ActiveDevicesPluginApi>("ActiveDevices");

// أسماء ملفات النغمات الجاهزة كما هي موجودة في android/app/src/main/res/raw
const PRESET_SOUND_FILES: Record<string, string> = {
  retro_arcade: "retro_arcade.wav",
  high_pitch: "high_pitch.wav",
  soft_chime: "soft_chime.wav",
  double_beep: "double_beep.wav"
};

export const CUSTOM_SOUND_KEY = "custom_device_sound";
const CUSTOM_SOUND_CHANNEL_ID = "session_end_custom";
const CUSTOM_SOUND_FLAG_KEY = "cyber_custom_sound_configured";

function channelIdForSound(soundAlertName: string): string {
  if (soundAlertName === CUSTOM_SOUND_KEY) return CUSTOM_SOUND_CHANNEL_ID;
  return `session_end_${soundAlertName || "double_beep"}`;
}

let presetChannelsCreated = false;

/**
 * ينشئ قناة إشعار منفصلة لكل نغمة جاهزة (مرة واحدة عند إقلاع التطبيق)، كل قناة مربوطة
 * بملف الصوت الخاص فيها. هذا إلزامي على أندرويد 8 (API 26) وما فوق لإظهار نغمات مختلفة.
 */
export async function ensureSessionEndChannels() {
  if (!isNative || presetChannelsCreated) return;
  try {
    for (const [name, file] of Object.entries(PRESET_SOUND_FILES)) {
      await LocalNotifications.createChannel({
        id: `session_end_${name}`,
        name: `تنبيه انتهاء الجلسة (${name})`,
        description: "إشعار بنغمة التطبيق المختارة عند انتهاء وقت الجلسة",
        sound: file,
        importance: 5,
        visibility: 1,
        vibration: true
      });
    }
    presetChannelsCreated = true;
  } catch (error) {
    console.error("Error creating session end notification channels:", error);
  }
}

/**
 * طلب الإذن لإرسال الإشعارات على نظام الأندرويد
 */
export async function requestNotificationPermission() {
  if (!isNative) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      await LocalNotifications.requestPermissions();
    }
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
  }
}

function getNotificationIdForDevice(deviceId: string): number {
  return Math.abs(
    deviceId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  );
}

/**
 * جدولة إشعار حقيقي في الأندرويد عند انتهاء وقت الجلسة، بالنغمة المختارة من إعدادات المستخدم
 */
export async function scheduleSessionEndNotification(
  deviceId: string,
  deviceName: string,
  durationMinutes: number,
  soundAlertName: string = "double_beep"
) {
  if (!isNative) return;
  try {
    await requestNotificationPermission();
    await ensureSessionEndChannels();

    const notificationId = getNotificationIdForDevice(deviceId);

    // إلغاء أي إشعار سابق بأمان
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }]
      });
    } catch (e) {
      // تجاهل إذا لم يكن موجوداً
    }

    if (!durationMinutes || durationMinutes <= 0) return;

    const triggerAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const channelId = channelIdForSound(soundAlertName);

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "⏳ انتهت جلسة اللعب!",
          body: `الجهاز [${deviceName}] انتهى وقت اللعب المحدد له بالكامل.`,
          id: notificationId,
          schedule: { at: triggerAt, allowWhileIdle: true },
          channelId,
          extra: { deviceId }
        }
      ]
    });
    console.log(`[Android Notification] Scheduled for ${deviceName} in ${durationMinutes} mins (channel: ${channelId})`);
  } catch (error) {
    console.error("Failed to schedule local notification:", error);
  }
}

/**
 * إلغاء الإشعار المجدول للجهاز
 */
export async function cancelSessionEndNotification(deviceId: string) {
  if (!isNative) return;
  try {
    const notificationId = getNotificationIdForDevice(deviceId);
    await LocalNotifications.cancel({
      notifications: [{ id: notificationId }]
    });
  } catch (error) {
    console.error("Failed to cancel local notification:", error);
  }
}

/**
 * يتأكد من أن التطبيق يملك كل الصلاحيات اللازمة لتشغيل التنبيهات بدقة بالخلفية:
 * 1. صلاحية جدولة تنبيه دقيق (Exact Alarm) - إلزامية لـ Android 12+.
 * 2. الإعفاء من تحسين البطارية - عمليًا ضروري على شاومي/هواوي/سامسونج وغيرها.
 * يُستحسن استدعاؤها مرة عند إقلاع التطبيق (وليس في كل مرة تُجدول فيها جلسة).
 */
export async function ensureBackgroundNotificationPermissions() {
  if (!isNative) return;
  try {
    const exact = await ActiveDevicesNative.canScheduleExactAlarms();
    if (!exact.value) {
      await ActiveDevicesNative.requestExactAlarmPermission();
    }
  } catch (error) {
    console.error("Error checking exact alarm permission:", error);
  }

  try {
    const battery = await ActiveDevicesNative.isIgnoringBatteryOptimizations();
    if (!battery.value) {
      await ActiveDevicesNative.requestIgnoreBatteryOptimizations();
    }
  } catch (error) {
    console.error("Error checking battery optimization exemption:", error);
  }
}

/**
 * يقرأ ملف صوت اختاره المستخدم من جهازه، يرسله للكود الأصلي (Native) ليُحفظ داخل
 * مساحة التطبيق، وينشئ قناة إشعار مخصصة مربوطة به.
 * يرجع true عند النجاح.
 */
export async function saveCustomDeviceSound(file: File): Promise<boolean> {
  if (!isNative) return false;
  try {
    const base64Data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // إزالة الجزء "data:audio/xxx;base64," والإبقاء على البيانات فقط
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await ActiveDevicesNative.saveCustomSound({
      base64Data,
      fileName: file.name || "custom_sound.mp3"
    });

    if (result?.success) {
      localStorage.setItem(CUSTOM_SOUND_FLAG_KEY, "1");
    }
    return !!result?.success;
  } catch (error) {
    console.error("Failed to save custom device sound:", error);
    return false;
  }
}

/**
 * هل قام المستخدم فعلاً باختيار نغمة مخصصة من جهازه سابقاً؟
 */
export function hasCustomDeviceSound(): boolean {
  return localStorage.getItem(CUSTOM_SOUND_FLAG_KEY) === "1";
}
