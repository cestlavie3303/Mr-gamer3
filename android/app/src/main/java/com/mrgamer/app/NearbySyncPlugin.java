package com.mrgamer.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
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
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADVERTISE }, alias = "btAdvertise"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "btConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "btScan"),
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.NEARBY_WIFI_DEVICES }, alias = "wifi")
    }
)
public class NearbySyncPlugin extends Plugin {

    private static final String SERVICE_ID = "com.mrgamer.app.SYNC_SERVICE";
    private static final Strategy STRATEGY = Strategy.P2P_POINT_TO_POINT;

    private ConnectionsClient connectionsClient;
    private String outgoingData;
    private String connectedEndpointId;
    private boolean hasSentData = false;

    private static String[] requiredPermissions() {
        List<String> perms = new ArrayList<>();
        // الموقع مطلوب في جميع إصدارات أندرويد لـ Nearby Connections
        perms.add(Manifest.permission.ACCESS_FINE_LOCATION);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // Android 12+
            perms.add(Manifest.permission.BLUETOOTH_ADVERTISE);
            perms.add(Manifest.permission.BLUETOOTH_CONNECT);
            perms.add(Manifest.permission.BLUETOOTH_SCAN);
        }
        if (Build.VERSION.SDK_INT >= 33) { // Android 13+
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
                if (bytes != null) {
                    String receivedJson = new String(bytes, StandardCharsets.UTF_8);
                    JSObject data = new JSObject();
                    data.put("data", receivedJson);
                    notifyListeners("dataReceived", data);
                    emitStatus("received", "تم استلام بيانات الجهاز الآخر");
                }
            }
        }

        @Override
        public void onPayloadTransferUpdate(String endpointId, PayloadTransferUpdate update) {
            if (update.getStatus() == PayloadTransferUpdate.Status.SUCCESS && hasSentData) {
                emitStatus("sent", "تم إرسال بياناتنا بنجاح");
            }
        }
    };

    @PluginMethod
    public void startSync(PluginCall call) {
        if (!hasAllPermissions()) {
            call.reject("الصلاحيات المطلوبة غير ممنوحة بعد");
            return;
        }

        final String deviceName = call.getString("deviceName", "MrGamer Device");
        outgoingData = call.getString("backupJson", "");
        hasSentData = false;
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
                    emitStatus("connected", "تم الاتصال بنجاح");
                    connectionsClient.stopAdvertising();
                    connectionsClient.stopDiscovery();
                    sendOutgoingData();
                } else {
                    emitStatus("error", "فشل الاتصال بالجهاز الآخر");
                }
            }

            @Override
            public void onDisconnected(String endpointId) {
                emitStatus("disconnected", "انقطع الاتصال");
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
                // تجاهل
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

    private void sendOutgoingData() {
        if (connectedEndpointId == null || outgoingData == null) return;
        byte[] bytes = outgoingData.getBytes(StandardCharsets.UTF_8);
        Payload payload = Payload.fromBytes(bytes);
        connectionsClient.sendPayload(connectedEndpointId, payload);
        hasSentData = true;
        emitStatus("sending", "جاري إرسال بياناتنا...");
    }

    @PluginMethod
    public void stopSync(PluginCall call) {
        if (connectionsClient != null) {
            connectionsClient.stopAdvertising();
            connectionsClient.stopDiscovery();
            connectionsClient.stopAllEndpoints();
        }
        connectedEndpointId = null;
        call.resolve();
    }

    private void emitStatus(String status, String message) {
        JSObject data = new JSObject();
        data.put("status", status);
        data.put("message", message);
        notifyListeners("statusUpdate", data);
    }
}
