package com.mrgamer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ActiveDevicesService extends Service {

    public static final String CHANNEL_ID = "active_devices_notification_channel";
    public static final String ACTION_UPDATE = "com.mrgamer.app.UPDATE_DEVICES";
    public static final String ACTION_STOP = "com.mrgamer.app.STOP_SERVICE";
    public static final String EXTRA_DEVICES_JSON = "devices_json";
    private static final int NOTIFICATION_ID = 1001;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private List<ActiveDeviceItem> activeDevices = new ArrayList<>();
    private final Map<String, Long> lastBeepTimestampMap = new HashMap<>();
    private boolean isRunning = false;

    public static class ActiveDeviceItem {
        public String id;
        public String name;
        public String sessionType;
        public int selectedDurationMinutes;
        public long accumulatedMs;
        public long lastTickTimestamp;
        public boolean isPaused;
        public String soundAlertName = "double_beep";
        public boolean soundEnabled = true;
    }

    private final Runnable updateRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isRunning) return;
            updateNotification();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (intent != null) {
                String action = intent.getAction();
                if (ACTION_STOP.equals(action)) {
                    safelyStop();
                    return START_NOT_STICKY;
                } else if (ACTION_UPDATE.equals(action) || action == null) {
                    String json = intent.getStringExtra(EXTRA_DEVICES_JSON);
                    parseDevicesJson(json);
                }
            }

            safelyStartForeground();

            if (activeDevices.isEmpty()) {
                safelyStop();
                return START_NOT_STICKY;
            }

            if (!isRunning) {
                isRunning = true;
                handler.post(updateRunnable);
            } else {
                updateNotification();
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }

        return START_STICKY;
    }

    private void safelyStartForeground() {
        try {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    startForeground(
                        NOTIFICATION_ID, 
                        notification, 
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    );
                } catch (Throwable t) {
                    try {
                        startForeground(NOTIFICATION_ID, notification);
                    } catch (Throwable t2) {
                        t2.printStackTrace();
                    }
                }
            } else {
                try {
                    startForeground(NOTIFICATION_ID, notification);
                } catch (Throwable t2) {
                    t2.printStackTrace();
                }
            }
        } catch (Throwable e) {
            e.printStackTrace();
        }
    }

    private void safelyStop() {
        isRunning = false;
        try {
            handler.removeCallbacks(updateRunnable);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private void parseDevicesJson(String jsonStr) {
        List<ActiveDeviceItem> list = new ArrayList<>();
        if (jsonStr == null || jsonStr.trim().isEmpty()) {
            this.activeDevices = list;
            return;
        }

        try {
            JSONArray array = new JSONArray(jsonStr);
            long now = System.currentTimeMillis();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                ActiveDeviceItem item = new ActiveDeviceItem();
                item.id = obj.optString("id", "");
                item.name = obj.optString("name", "");
                item.sessionType = obj.optString("sessionType", "OPEN");
                item.selectedDurationMinutes = obj.optInt("selectedDurationMinutes", 0);
                item.accumulatedMs = obj.optLong("accumulatedMs", 0);
                item.lastTickTimestamp = obj.optLong("lastTickTimestamp", now);
                item.isPaused = obj.optBoolean("isPaused", false);
                item.soundAlertName = obj.optString("soundAlertName", "double_beep");
                item.soundEnabled = obj.optBoolean("soundEnabled", true);
                list.add(item);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        this.activeDevices = list;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "حالة الأجهزة النشطة",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("إشعار ثائم يعرض حالة الأجهزة والوقت المتبقي للجلسات النشطة");
                channel.setShowBadge(false);
                // إلغاء صوت نغمة الموبايل العادية تماماً لعدم التشويش
                channel.setSound(null, null);
                channel.enableVibration(false);

                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }
    }

    private boolean isPcDevice(String name) {
        if (name == null) return false;
        String n = name.toLowerCase();
        return n.contains("كمبيوتر") || n.contains("كومبيوتر") || n.contains("pc") || n.contains("computer") || n.contains("حاسوب");
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // فرز الأجهزة: بلايستيشن أولاً ثم الكمبيوتر
        List<ActiveDeviceItem> sortedDevices = new ArrayList<>(activeDevices);
        Collections.sort(sortedDevices, new Comparator<ActiveDeviceItem>() {
            @Override
            public int compare(ActiveDeviceItem d1, ActiveDeviceItem d2) {
                boolean isPc1 = isPcDevice(d1.name);
                boolean isPc2 = isPcDevice(d2.name);
                if (isPc1 == isPc2) return d1.name.compareTo(d2.name);
                return isPc1 ? 1 : -1; // PlayStation (-1) comes before PC (1)
            }
        });

        int activeCount = sortedDevices.size();
        String title = "الأجهزة النشطة (" + activeCount + ")";
        
        // النص المختصر للإشعار (يظهر عندما يكون الإشعار مطوياً)
        StringBuilder summary = new StringBuilder();
        for (int i = 0; i < Math.min(activeCount, 2); i++) {
            if (i > 0) summary.append(" | ");
            summary.append(sortedDevices.get(i).name);
        }
        if (activeCount > 2) summary.append("...");

        RemoteViews expandedViews = new RemoteViews(getPackageName(), R.layout.notification_active_devices);
        expandedViews.removeAllViews(R.id.device_list_container);

        long now = System.currentTimeMillis();
        
        // استخدام التصميم المكثف إذا كان عدد الأجهزة أكثر من 4
        boolean useCompactMode = activeCount > 4;
        
        // إزالة العناوين إذا كان العدد كبير جداً لتوفير مساحة قصوى
        boolean showHeaders = activeCount <= 8;

        // فصل الأجهزة حسب النوع للعناوين
        List<ActiveDeviceItem> psDevices = new ArrayList<>();
        List<ActiveDeviceItem> pcDevices = new ArrayList<>();
        for (ActiveDeviceItem dev : sortedDevices) {
            if (isPcDevice(dev.name)) pcDevices.add(dev);
            else psDevices.add(dev);
        }

        addDevicesToView(expandedViews, psDevices, showHeaders ? "أجهزة البلايستيشن" : null, useCompactMode, now);
        addDevicesToView(expandedViews, pcDevices, showHeaders ? "أجهزة الكومبيوتر" : null, useCompactMode, now);

        int iconRes = android.R.drawable.ic_dialog_info;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(summary.toString())
                .setCustomBigContentView(expandedViews)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSound(null)
                .setContentIntent(pendingIntent);

        return builder.build();
    }

    private void addDevicesToView(RemoteViews container, List<ActiveDeviceItem> devices, String header, boolean compact, long now) {
        if (devices.isEmpty()) return;

        // إضافة عنوان المجموعة إذا لم يكن null
        if (header != null) {
            RemoteViews headerView = new RemoteViews(getPackageName(), R.layout.notification_header_item);
            headerView.setTextViewText(R.id.header_title, header);
            container.addView(R.id.device_list_container, headerView);
        }

        for (ActiveDeviceItem dev : devices) {
            int layoutId = compact ? R.layout.notification_device_item_compact : R.layout.notification_device_item;
            RemoteViews item = new RemoteViews(getPackageName(), layoutId);
            
            boolean isPc = isPcDevice(dev.name);
            int baseColor = ContextCompat.getColor(this, isPc ? R.color.pc_orange : R.color.ps_blue);
            int iconRes = isPc ? R.drawable.ic_computer : R.drawable.ic_playstation;
            
            long elapsedMs = dev.accumulatedMs;
            if (!dev.isPaused && dev.lastTickTimestamp > 0) {
                long sinceLastTick = now - dev.lastTickTimestamp;
                if (sinceLastTick > 0) elapsedMs += sinceLastTick;
            }

            boolean isOpen = "OPEN".equals(dev.sessionType) || dev.selectedDurationMinutes <= 0;
            String statusText;
            int finalColor = baseColor;

            if (dev.isPaused) {
                statusText = "متوقف مؤقتاً";
            } else if (isOpen) {
                statusText = "مفتوحة (" + formatTime(elapsedMs) + ")";
            } else {
                long totalMs = dev.selectedDurationMinutes * 60L * 1000L;
                long remainingMs = totalMs - elapsedMs;
                if (remainingMs > 0) {
                    statusText = "متبقي " + formatTime(remainingMs);
                    // تمييز الحالات الحرجة (أقل من 5 دقائق) باللون الأحمر
                    if (remainingMs < 5 * 60 * 1000) {
                        finalColor = ContextCompat.getColor(this, R.color.urgency_red);
                    }
                } else {
                    statusText = "انتهى الوقت! (+" + formatTime(Math.abs(remainingMs)) + ")";
                    finalColor = ContextCompat.getColor(this, R.color.urgency_red);
                }
            }

            item.setTextViewText(R.id.device_name, dev.name);
            item.setTextViewText(R.id.device_status, statusText);
            item.setTextColor(R.id.device_name, finalColor);
            item.setImageViewResource(R.id.device_icon, iconRes);
            item.setInt(R.id.device_icon, "setColorFilter", finalColor);
            
            container.addView(R.id.device_list_container, item);
        }
    }

    private void checkAndPlayNativeBeep(ActiveDeviceItem dev, long now) {
        if (!dev.soundEnabled) return;

        Long lastBeep = lastBeepTimestampMap.get(dev.id);
        if (lastBeep == null) lastBeep = 0L;

        // تكرار الصوت الخاص بالتطبيق كل 12 ثانية طالما الوقت منتهي
        if (now - lastBeep > 12000) {
            lastBeepTimestampMap.put(dev.id, now);
            playNativeTone(dev.soundAlertName);
        }
    }

    /**
     * مولد أصوات التنبيه الخاص بالتطبيق بلغة Java ليعمل بالنظام والمطبّق بالخلفية أوفلاين
     */
    private void playNativeTone(final String toneName) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if ("high_pitch".equals(toneName)) {
                        playToneSequence(new int[]{880, 880, 880}, new int[]{200, 200, 400}, new int[]{100, 100, 0});
                    } else if ("retro_arcade".equals(toneName)) {
                        playToneSequence(new int[]{523, 659, 783, 1046}, new int[]{100, 100, 100, 300}, new int[]{50, 50, 50, 0});
                    } else if ("soft_chime".equals(toneName)) {
                        playToneSequence(new int[]{440, 554, 659}, new int[]{300, 300, 500}, new int[]{100, 100, 0});
                    } else { // double_beep (الافتراضي)
                        playToneSequence(new int[]{600, 600}, new int[]{150, 150}, new int[]{100, 0});
                    }
                } catch (Throwable t) {
                    t.printStackTrace();
                }
            }
        }).start();
    }

    private void playToneSequence(int[] freqs, int[] durations, int[] delays) {
        int sampleRate = 22050;
        for (int k = 0; k < freqs.length; k++) {
            int freq = freqs[k];
            int durationMs = durations[k];
            int delayMs = delays[k];

            int numSamples = (sampleRate * durationMs) / 1000;
            byte[] generatedSnd = new byte[2 * numSamples];

            for (int i = 0; i < numSamples; ++i) {
                double sample = Math.sin(2 * Math.PI * i / (sampleRate / (double) freq));
                short val = (short) (sample * 32767);
                generatedSnd[2 * i] = (byte) (val & 0x00ff);
                generatedSnd[2 * i + 1] = (byte) ((val & 0xff00) >> 8);
            }

            try {
                AudioTrack track = new AudioTrack(
                        AudioManager.STREAM_ALARM,
                        sampleRate,
                        AudioFormat.CHANNEL_OUT_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        generatedSnd.length,
                        AudioTrack.MODE_STATIC
                );
                track.write(generatedSnd, 0, generatedSnd.length);
                track.play();
                Thread.sleep(durationMs + delayMs);
                track.release();
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }
    }

    private void updateNotification() {
        if (activeDevices.isEmpty()) {
            safelyStop();
            return;
        }
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, buildNotification());
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private String formatTime(long ms) {
        long totalSeconds = Math.max(0, ms / 1000);
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        if (hours > 0) {
            return String.format("%02d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format("%02d:%02d", minutes, seconds);
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        try {
            handler.removeCallbacks(updateRunnable);
        } catch (Throwable t) {}
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
