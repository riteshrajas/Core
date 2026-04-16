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

### **MQTT.js (L2)**
- **Architecture:** MiniMax nodes publish to an MQTT broker (e.g., Mosquitto). Horizon will act as a client.
- **PWA Constraint:** Must use WebSockets (WSS) to connect to the broker, as standard TCP sockets are restricted in-browser.
- **Latency:** Target <100ms for local room telemetry.

### **WebSockets / LTE Bridge (L3)**
- **Architecture:** MegaMax nodes communicate via a relay server (Apex Cloud).
- **Fall-back:** SMS commands will be managed via the Cloud API, not direct browser-to-SIM communication.

## 3. Hardware Abstraction Interface
To keep `app.js` clean, I will implement a `TransportAdapter` base class:
```javascript
class TransportAdapter {
  async connect(endpoint) {}
  async send(payload) {}
  onData(callback) {}
  onStatusChange(callback) {}
}
```

## 4. Semantic Parsing & Brain Integration
Hardware events (e.g., `{"event": "TRIGGER", "presence": true}`) will be transformed into "Semantic Context Strings" before being sent to the RAM Ingestion API:
- *Raw:* `{"node_id": "MMX-01", "sensors": {"temp": 24.5}}`
- *Semantic:* "Device Workspace-Alpha reports a temperature of 24.5°C at [Timestamp]."

## 5. Next Steps
- Implement `SerialAdapter.js`.
- Implement `MqttAdapter.js`.
- Integrate `mqtt.js` library via CDN or local module.
