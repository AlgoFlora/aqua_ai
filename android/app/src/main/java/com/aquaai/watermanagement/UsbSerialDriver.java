package com.aquaai.watermanagement;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.util.Log;

/**
 * Generic USB Serial Driver supporting:
 *  - CDC ACM (Arduino UNO native USB)
 *  - CH340/CH341 (common USB-Serial chip on Arduino clones)
 *  - CP2102 / FTDI (alternative chips)
 *
 *  This driver handles the lowest-level USB bulk transfer communication.
 */
public class UsbSerialDriver {

    private static final String TAG = "UsbSerialDriver";

    private final UsbDevice device;
    private final UsbDeviceConnection connection;

    private UsbInterface  dataInterface;
    private UsbEndpoint   inEndpoint;
    private UsbEndpoint   outEndpoint;
    private boolean       opened = false;

    public UsbSerialDriver(UsbDevice device, UsbDeviceConnection connection) {
        this.device     = device;
        this.connection = connection;
    }

    public void open() throws Exception {
        // Iterate interfaces to find bulk endpoints
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface intf = device.getInterface(i);
            UsbEndpoint epIn  = null;
            UsbEndpoint epOut = null;
            for (int j = 0; j < intf.getEndpointCount(); j++) {
                UsbEndpoint ep = intf.getEndpoint(j);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    if (ep.getDirection() == UsbConstants.USB_DIR_IN)  epIn  = ep;
                    if (ep.getDirection() == UsbConstants.USB_DIR_OUT) epOut = ep;
                }
            }
            if (epIn != null && epOut != null) {
                dataInterface = intf;
                inEndpoint    = epIn;
                outEndpoint   = epOut;
                break;
            }
        }
        if (inEndpoint == null || outEndpoint == null) {
            throw new Exception("No bulk endpoints found on USB device — not a serial device?");
        }
        if (!connection.claimInterface(dataInterface, true)) {
            throw new Exception("Could not claim USB interface");
        }

        // Initialize CH340 if detected
        int vid = device.getVendorId();
        if (vid == 0x1a86) {  // CH340
            initCH340();
        } else if (vid == 0x0403) {  // FTDI
            initFTDI();
        } else if (vid == 0x10C4) {  // CP2102
            initCP2102();
        }
        // CDC ACM (0x2341 Arduino) usually needs no special init

        opened = true;
        Log.d(TAG, "USB Serial opened — VID=" + Integer.toHexString(vid));
    }

    private void initCH340() {
        // CH340 init sequence for 9600 baud
        connection.controlTransfer(0x40, 0xa1, 0, 0, null, 0, 0);
        connection.controlTransfer(0x40, 0x9a, 0x1312, 0xd982, null, 0, 0);
        connection.controlTransfer(0x40, 0x9a, 0x0f2c, 0x0008, null, 0, 0);
        connection.controlTransfer(0xc0, 0x95, 0x2518, 0,   new byte[8], 8, 0);
        connection.controlTransfer(0x40, 0x9a, 0x2518, 0x0050, null, 0, 0);
        connection.controlTransfer(0xc0, 0x95, 0,      0,   new byte[8], 8, 0);
        connection.controlTransfer(0x40, 0xa1, 0x501f, 0xd90a, null, 0, 0);
        // Set 9600 baud
        connection.controlTransfer(0x40, 0x9a, 0x1312, 0xc09c, null, 0, 0);
        connection.controlTransfer(0x40, 0x9a, 0x0f2c, 0x0008, null, 0, 0);
        connection.controlTransfer(0x40, 0xa4, ~0x0002, 0, null, 0, 0);
    }

    private void initFTDI() {
        // FTDI reset + set baud 9600
        connection.controlTransfer(0x40, 0,    0, 0, null, 0, 0);   // reset
        connection.controlTransfer(0x40, 3, 0x4138, 0, null, 0, 0); // 9600 baud
    }

    private void initCP2102() {
        // CP210x enable + 9600 baud
        connection.controlTransfer(0x41, 0x00, 0x0001, 0, null, 0, 0); // IFC_ENABLE
        connection.controlTransfer(0x40, 0x1e, 0, 0,
            new byte[]{(byte)0x80, 0x25, 0, 0}, 4, 0); // SET_BAUDRATE 9600
    }

    public int read(byte[] buffer, int timeout) {
        if (!opened || inEndpoint == null) return 0;
        return connection.bulkTransfer(inEndpoint, buffer, buffer.length, timeout);
    }

    public int write(byte[] data, int timeout) {
        if (!opened || outEndpoint == null) return 0;
        return connection.bulkTransfer(outEndpoint, data, data.length, timeout);
    }

    public void close() {
        try {
            if (dataInterface != null) connection.releaseInterface(dataInterface);
        } catch (Exception e) {
            Log.e(TAG, "Error releasing interface", e);
        }
        opened = false;
    }
}
