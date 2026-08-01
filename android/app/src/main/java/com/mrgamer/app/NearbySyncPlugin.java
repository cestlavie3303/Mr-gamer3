package com.mrgamer.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "NearbySync",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADVERTISE }, alias = "btAdvertise"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "btConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "btScan"),
        @Permission(strings = { Manifest.permission.NEARBY_WIFI_DEVICES }, alias = "wifi")
    }
)
public class NearbySyncPlugin extends Plugin {

    private static final String SERVICE_ID = "com.mrgamer.app.SYNC_SERVICE";
    private static final Strategy STRATEGY = Strategy.P2P_POINT_TO_POINT;

    private ConnectionsClient connectionsClient;
    private String outgoingData;
    private long outgoingTimestamp = 0;
    private String connectedEndpointId;
    private boolean isSendingFullData = false;

    private static String[] requiredPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.ACCESS_FINE_LOCATION);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_ADVERTISE);
            perms.add(Manifest.permission.BLUETOOTH_CONNECT);
            perms.add(Manifest.permission.BLUETOOTH_SCAN);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            perms.add(Manifest.permission.NEARBY_WIFI_DEVICES);
        }
        return perms.toArray(new String[0]);
    }

    private boolean hasAllPermissions() {
        for (String p : requiredPermissions()) {
            if (ContextCompat.checkSelfPermission(getContext(), p) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void checkSyncPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAllPermissions());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSyncPermissions(PluginCall call) {
        if (hasAllPermissions()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestAllPermissions(call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAllPermissions());
        call.resolve(ret);
    }

    private final PayloadCallback payloadCallback = new PayloadCallback() {
        @Override
        public void onPayloadReceived(String endpointId, Payload payload) {
            if (payload.getType() == Payload.Type.BYTES) {
                byte[] bytes = payload.asBytes();
                if (bytes == null) return;
                String receivedStr = new String(bytes, StandardCharsets.UTF_8);

                if (receivedStr.startsWith("TIME:")) {
                    try {
                        long incomingTime = Long.parseLong(receivedStr.replace("TIME:", "").trim());
                        handleTimestampExchange(incomingTime);
                    } catch (Exception e) {
                        emitStatus("error", "خطأ في قراءة تاريخ المزامنة");
                    }
                } else {
                    JSObject data = new JSObject();
                    data.put("data", receivedStr);
                    notifyListeners("dataReceived", data);
                    emitStatus("received", "تم استلام النسخة الأحدث بنجاح");
                    
                    // تأخير إغلاق الاتصال بعد الاستلام لضمان المعالجة
                    new Handler(Looper.getMainLooper()).postDelayed(() -> disconnectAndClean(), 1500);
                }
            }
        }

        @Override
        public void onPayloadTransferUpdate(String endpointId, PayloadTransferUpdate update) {
            if (update.getStatus() == PayloadTransferUpdate.Status.SUCCESS) {
                if (isSendingFullData) {
                    emitStatus("sent", "تم إرسال البيانات الحديثة بنجاح");
                    isSendingFullData = false;
                    new Handler(Looper.getMainLooper()).postDelayed(() -> disconnectAndClean(), 1500);
                }
            } else if (update.getStatus() == PayloadTransferUpdate.Status.FAILURE) {
                emitStatus("error", "فشل نقل الملف أثناء الإرسال");
            }
        }
    };

    private void handleTimestampExchange(long incomingTime) {
        if (outgoingTimestamp > incomingTime) {
            // بياناتنا أحدث -> نرسل ملفنا الكامل
            emitStatus("sending", "بياناتنا هي الأحدث، جاري إرسالها...");
            sendFullData();
        } else if (outgoingTimestamp < incomingTime) {
            // بيانات الجهاز الآخر أحدث -> ننتظر استلام ملفه
            emitStatus("receiving", "بيانات الجهاز الآخر أحدث، جاري الاستلام...");
        } else {
            // البيانات متطابقة تماماً
            emitStatus("upToDate", "البيانات متطابقة تماماً بين الجهازين");
            new Handler(Looper.getMainLooper()).postDelayed(() -> disconnectAndClean(), 1000);
        }
    }

    @PluginMethod
    public void startSync(PluginCall call) {
        if (!hasAllPermissions()) {
            call.reject("الصلاحيات المطلوبة غير ممنوحة بعد");
            return;
        }

        final String deviceName = call.getString("deviceName", "MrGamer Device");
        outgoingData = call.getString("backupJson", "");
        outgoingTimestamp = call.getLong("timestamp", System.currentTimeMillis());
        isSendingFullData = false;
        connectedEndpointId = null;

        connectionsClient = Nearby.getConnectionsClient(getContext());

        final ConnectionLifecycleCallback connectionLifecycleCallback = new ConnectionLifecycleCallback() {
            @Override
            public void onConnectionInitiated(String endpointId, ConnectionInfo connectionInfo) {
                emitStatus("connecting", "جاري الاتصال بـ " + connectionInfo.getEndpointName());
                connectionsClient.acceptConnection(endpointId, payloadCallback);
            }

            @Override
            public void onConnectionResult(String endpointId, ConnectionResolution result) {
                if (result.getStatus().isSuccess()) {
                    connectedEndpointId = endpointId;
                    emitStatus("connected", "تم الاتصال، جاري مقارنة التواريخ...");
                    connectionsClient.stopAdvertising();
                    connectionsClient.stopDiscovery();
                    
                    // إرسال التاريخ بعد الاتصال بوقت قصير لضمان جاهزية القناة
                    new Handler(Looper.getMainLooper()).postDelayed(() -> sendTimestampOnly(), 500);
                } else {
                    emitStatus("error", "فشل الاتصال بالجهاز الآخر");
                }
            }

            @Override
            public void onDisconnected(String endpointId) {
                connectedEndpointId = null;
                emitStatus("disconnected", "تم إنهاء الاتصال بنجاح");
            }
        };

        EndpointDiscoveryCallback endpointDiscoveryCallback = new EndpointDiscoveryCallback() {
            @Override
            public void onEndpointFound(String endpointId, DiscoveredEndpointInfo info) {
                emitStatus("endpointFound", "تم العثور على جهاز: " + info.getEndpointName());
                connectionsClient.requestConnection(deviceName, endpointId, connectionLifecycleCallback);
            }

            @Override
            public void onEndpointLost(String endpointId) {
                // ignore
            }
        };

        AdvertisingOptions advertisingOptions = new AdvertisingOptions.Builder().setStrategy(STRATEGY).build();
        connectionsClient.startAdvertising(deviceName, SERVICE_ID, connectionLifecycleCallback, advertisingOptions)
            .addOnSuccessListener(unused -> emitStatus("advertising", "جاري البحث عن الجهاز الآخر..."))
            .addOnFailureListener(e -> emitStatus("error", "تعذّر بدء الإعلان: " + e.getMessage()));

        DiscoveryOptions discoveryOptions = new DiscoveryOptions.Builder().setStrategy(STRATEGY).build();
        connectionsClient.startDiscovery(SERVICE_ID, endpointDiscoveryCallback, discoveryOptions)
            .addOnFailureListener(e -> emitStatus("error", "تعذّر بدء الاكتشاف: " + e.getMessage()));

        call.resolve();
    }

    private void sendTimestampOnly() {
        if (connectedEndpointId == null) return;
        String timeMsg = "TIME:" + outgoingTimestamp;
        Payload payload = Payload.fromBytes(timeMsg.getBytes(StandardCharsets.UTF_8));
        connectionsClient.sendPayload(connectedEndpointId, payload);
    }

    private void sendFullData() {
        if (connectedEndpointId == null || outgoingData == null) return;
        isSendingFullData = true;
        Payload payload = Payload.fromBytes(outgoingData.getBytes(StandardCharsets.UTF_8));
        connectionsClient.sendPayload(connectedEndpointId, payload);
    }

    private void disconnectAndClean() {
        if (connectionsClient != null) {
            connectionsClient.stopAdvertising();
            connectionsClient.stopDiscovery();
            if (connectedEndpointId != null) {
                connectionsClient.disconnectFromEndpoint(connectedEndpointId);
            }
            connectionsClient.stopAllEndpoints();
        }
        connectedEndpointId = null;
        isSendingFullData = false;
    }

    @PluginMethod
    public void stopSync(PluginCall call) {
        disconnectAndClean();
        call.resolve();
    }

    private void emitStatus(String status, String message) {
        JSObject data = new JSObject();
        data.put("status", status);
        data.put("message", message);
        notifyListeners("statusUpdate", data);
    }
}
