# Research: Apex Horizon Universal Transport Hub

## 1. Objective
To design a robust, non-blocking transport layer for the Apex Horizon PWA that manages simultaneous connections across three distinct protocols:
- **Level 1 (Wired):** Web Serial API (Direct USB CDC).
- **Level 2 (Wireless):** MQTT.js (Local WiFi Broker).
- **Level 3 (Global):** WebSockets (LTE/Cloud Bridge).

## 2. Capability Audit

### **Web Serial API (L1)**
- **Availability:** Supported in Chromium-based browsers (Chrome, Edge).
- **Concurrency:** Browsers allow multiple ports to be open simultaneously, but we will restrict Horizon to one "Active" port per scope.
- **Buffer Management:** Must use `TextDecoderStream` and `TextEncoderStream` to handle large JSON payloads from MicroMax nodes without blocking the UI thread.
- **Implementation Note:** `navigator.serial.requestPort()` requires user gesture. Once authorized, `port.open({ baudRate: 115200 })` is used.

### **MQTT.js (L2)**
- **Architecture:** MiniMax nodes publish to an MQTT broker (e.g., Mosquitto). Horizon will act as a client.
- **PWA Constraint:** Must use WebSockets (WSS) to connect to the broker, as standard TCP sockets are restricted in-browser.
- **Library:** `https://unpkg.com/mqtt/dist/mqtt.min.js` provides a browser-compatible bundle.
- **Latency:** Target <100ms for local room telemetry.

### **WebSockets / LTE Bridge (L3)**
- **Architecture:** MegaMax nodes communicate via a relay server (Apex Cloud).
- **Fall-back:** SMS commands will be managed via the Cloud API, not direct browser-to-SIM communication.
- **Protocol:** Standard `WebSocket` API with JSON framing.

## 3. Hardware Abstraction Interface
To keep `app.js` clean, I will implement a `TransportAdapter` base class:
```javascript
class TransportAdapter {
  constructor() {
    this.onData = null;
    this.onStatusChange = null;
  }
  async connect(endpoint) {}
  async disconnect() {}
  async send(payload) {}
}
```

## 4. Semantic Parsing & Brain Integration
Hardware events (e.g., `{"event": "TRIGGER", "presence": true}`) will be transformed into "Semantic Context Strings" before being sent to the RAM Ingestion API:
- *Raw:* `{"node_id": "MMX-01", "sensors": {"temp": 24.5}}`
- *Semantic:* "Device Workspace-Alpha reports a temperature of 24.5°C at [Timestamp]."

## 5. Implementation Plan
1. Create `TransportAdapter.js` base class.
2. Create `SerialAdapter.js` (L1).
3. Create `MqttAdapter.js` (L2).
4. Create `CloudAdapter.js` (L3).
5. Refactor `app.js` to use these adapters.
