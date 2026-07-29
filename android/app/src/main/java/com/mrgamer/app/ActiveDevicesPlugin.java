package com.mrgamer.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "ActiveDevices")
public class ActiveDevicesPlugin extends Plugin {

    @PluginMethod
    public void updateActiveDevices(PluginCall call) {
        try {
            String jsonDevices = call.getString("devices", "[]");
            Intent intent = new Intent(getContext(), ActiveDevicesService.class);
            intent.setAction(ActiveDevicesService.ACTION_UPDATE);
            intent.putExtra(ActiveDevicesService.EXTRA_DEVICES_JSON, jsonDevices);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            call.resolve();
        } catch (Throwable e) {
            e.printStackTrace();
            // Resolve gracefully so JS never crashes on plugin calls
            call.resolve();
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), ActiveDevicesService.class);
            intent.setAction(ActiveDevicesService.ACTION_STOP);
            getContext().startService(intent);
            call.resolve();
        } catch (Throwable e) {
            e.printStackTrace();
            call.resolve();
        }
    }

    /**
     * يتحقق فيما إذا كان التطبيق مسموح له بجدولة تنبيهات دقيقة (Exact Alarms).
     * على أندرويد 12+ (API 31+) هذه الصلاحية قد يلغيها المستخدم يدويًا من الإعدادات.
     * على ما قبل API 31 ترجع true دائمًا لأن الصلاحية غير موجودة أصلًا.
     */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // API 31+
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                ret.put("value", alarmManager != null && alarmManager.canScheduleExactAlarms());
            } else {
                ret.put("value", true);
            }
        } catch (Throwable t) {
            t.printStackTrace();
            ret.put("value", true);
        }
        call.resolve(ret);
    }

    /**
     * يفتح شاشة إعدادات النظام حيث يمكن للمستخدم منح صلاحية الـ Exact Alarms يدويًا.
     * لا يوجد نتيجة مباشرة، لذلك على الواجهة إعادة استدعاء canScheduleExactAlarms بعد العودة من الإعدادات.
     */
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // API 31+
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }
        call.resolve();
    }

    /**
     * يتحقق فيما إذا كان التطبيق معفى من تحسين البطارية (Doze/Battery Optimization).
     * الشركات المصنعة (شاومي، هواوي، سامسونج...) تميل لقتل الخدمات/التنبيهات بالخلفية
     * حتى لو كانت الصلاحيات الرسمية ممنوحة، لذلك هذا الفحص إضافي ومهم جدًا عمليًا.
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            ret.put("value", ignoring);
        } catch (Throwable t) {
            t.printStackTrace();
            ret.put("value", true);
        }
        call.resolve(ret);
    }

    /**
     * يطلب من المستخدم إعفاء التطبيق من تحسين البطارية عبر نافذة نظام مباشرة.
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Throwable t) {
            t.printStackTrace();
        }
        call.resolve();
    }

    /**
     * يحفظ ملف الصوت الذي اختاره المستخدم من جهازه داخل مساحة تخزين التطبيق الخاصة،
     * ثم ينشئ (أو يعيد إنشاء) قناة إشعار مخصصة "session_end_custom" مربوطة بهذا الملف
     * عبر FileProvider حتى يستطيع نظام الأندرويد قراءته وتشغيله كنغمة إشعار.
     */
    @PluginMethod
    public void saveCustomSound(PluginCall call) {
        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName", "custom_sound.mp3");
            if (base64Data == null || base64Data.isEmpty()) {
                call.reject("لا يوجد بيانات صوت لحفظها");
                return;
            }

            // الاحتفاظ بامتداد الملف الأصلي فقط (mp3/wav/ogg...) لضمان تعرف النظام عليه بشكل صحيح
            String extension = "mp3";
            int dotIndex = fileName.lastIndexOf('.');
            if (dotIndex != -1 && dotIndex < fileName.length() - 1) {
                extension = fileName.substring(dotIndex + 1).toLowerCase();
            }

            byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);

            File soundsDir = new File(getContext().getFilesDir(), "custom_sounds");
            if (!soundsDir.exists()) {
                soundsDir.mkdirs();
            }

            // حذف أي ملف نغمة مخصصة قديم أولاً
            File[] oldFiles = soundsDir.listFiles();
            if (oldFiles != null) {
                for (File f : oldFiles) {
                    f.delete();
                }
            }

            File soundFile = new File(soundsDir, "custom_notification." + extension);
            try (FileOutputStream fos = new FileOutputStream(soundFile)) {
                fos.write(audioBytes);
            }

            Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    soundFile
            );

            // منح صلاحية القراءة لنظام الإشعارات حتى يستطيع تشغيل الصوت من هذا الملف
            getContext().grantUriPermission("com.android.systemui", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().grantUriPermission("android", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    // حذف القناة القديمة أولاً لأن أندرويد لا يسمح بتغيير صوت قناة موجودة
                    manager.deleteNotificationChannel("session_end_custom");

                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();

                    NotificationChannel channel = new NotificationChannel(
                            "session_end_custom",
                            "تنبيه انتهاء الجلسة (نغمة مخصصة)",
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("إشعار بالنغمة المخصصة التي اخترتها من جهازك");
                    channel.setSound(contentUri, audioAttributes);
                    channel.enableVibration(true);
                    manager.createNotificationChannel(channel);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Throwable t) {
            t.printStackTrace();
            call.reject("فشل حفظ ملف الصوت المخصص: " + t.getMessage());
        }
    }
}
