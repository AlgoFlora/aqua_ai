package com.aquaai.watermanagement;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Iterator;

// USB Serial using Android USB Host API
// Compatible with Arduino UNO (CH340, CP2102, FTDI, CDC ACM)
@CapacitorPlugin(name = "UsbSerial")
public class UsbSerialPlugin extends Plugin {

    private static final String TAG = "AquaAI_USB";
    private static final String ACTION_USB_PERMISSION = "com.aquaai.watermanagement.USB_PERMISSION";

    private UsbManager usbManager;
    private UsbDevice  usbDevice;
    private UsbDeviceConnection connection;
    private UsbSerialDriver serialDriver;

    private final StringBuilder readBuffer = new StringBuilder();
    private boolean isConnected = false;

    private final BroadcastReceiver usbPermissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null) {
                            openDevice(device);
                        }
                    } else {
                        Log.d(TAG, "USB permission denied for device " + device);
                    }
                }
            }
        }
    };

    @Override
    public void load() {
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(usbPermissionReceiver, filter);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        int baudRate = call.getInt("baudRate", 9600);

        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        if (deviceList.isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "No USB devices found. Connect Arduino via USB OTG.");
            call.resolve(result);
            return;
        }

        // Find Arduino-compatible device
        Iterator<UsbDevice> iter = deviceList.values().iterator();
        UsbDevice targetDevice = null;
        while (iter.hasNext()) {
            UsbDevice d = iter.next();
            int vid = d.getVendorId();
            // Arduino UNO (CH340: 0x1a86, FTDI: 0x0403, CP2102: 0x10C4, CDC: 0x2341)
            if (vid == 0x1a86 || vid == 0x0403 || vid == 0x10C4 || vid == 0x2341
                || vid == 0x239A || vid == 0x1B4F || vid == 0x16D0) {
                targetDevice = d;
                break;
            }
        }

        if (targetDevice == null) {
            // Try any device
            targetDevice = deviceList.values().iterator().next();
        }

        if (!usbManager.hasPermission(targetDevice)) {
            PendingIntent permissionIntent = PendingIntent.getBroadcast(
                getContext(), 0,
                new Intent(ACTION_USB_PERMISSION),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE
                    : 0
            );
            usbManager.requestPermission(targetDevice, permissionIntent);
            // Store call for later resolution
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "USB permission requested — please approve and retry.");
            call.resolve(result);
            return;
        }

        openDevice(targetDevice);
        JSObject result = new JSObject();
        result.put("success", isConnected);
        result.put("message", isConnected ? "Arduino connected via USB" : "Failed to open USB device");
        call.resolve(result);
    }

    private void openDevice(UsbDevice device) {
        try {
            this.usbDevice   = device;
            this.connection  = usbManager.openDevice(device);
            this.serialDriver = new UsbSerialDriver(device, connection);
            this.serialDriver.open();
            this.isConnected = true;
            Log.d(TAG, "USB device opened: " + device.getDeviceName());
        } catch (Exception e) {
            Log.e(TAG, "Failed to open USB device", e);
            this.isConnected = false;
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        if (!isConnected || serialDriver == null) {
            JSObject result = new JSObject();
            result.put("data", "");
            call.resolve(result);
            return;
        }
        try {
            byte[] buf = new byte[256];
            int len = serialDriver.read(buf, 200);
            if (len > 0) {
                readBuffer.append(new String(buf, 0, len));
            }
            // Return complete lines
            String data = readBuffer.toString();
            int lastNewline = data.lastIndexOf('\n');
            if (lastNewline >= 0) {
                String lines = data.substring(0, lastNewline + 1);
                readBuffer.delete(0, lastNewline + 1);
                JSObject result = new JSObject();
                result.put("data", lines);
                call.resolve(result);
            } else {
                JSObject result = new JSObject();
                result.put("data", "");
                call.resolve(result);
            }
        } catch (Exception e) {
            isConnected = false;
            call.reject("Read error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String data = call.getString("data", "");
        if (!isConnected || serialDriver == null || data == null) {
            call.resolve(new JSObject());
            return;
        }
        try {
            serialDriver.write(data.getBytes(), 200);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Write error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (serialDriver != null) serialDriver.close();
            if (connection != null)  connection.close();
            isConnected = false;
        } catch (Exception e) {
            Log.e(TAG, "Disconnect error", e);
        }
        call.resolve(new JSObject());
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(usbPermissionReceiver);
            if (serialDriver != null) serialDriver.close();
            if (connection  != null) connection.close();
        } catch (Exception e) {
            Log.e(TAG, "Cleanup error", e);
        }
    }
}
