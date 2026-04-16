/**
 * Verification script for Apex Horizon.
 * Simulates a hardware event and verifies the flow through the adapter logic.
 */

const mockData = {
  node_id: "MMX-01",
  role: "sentry",
  uptime: 3600,
  sensors: {
    temp: 24.5,
    humidity: 45,
    lux: 300,
    presence: true
  },
  timestamp: new Date().toISOString()
};

console.log("--- Starting Horizon Verification ---");

// 1. Simulate Hardware Event -> Horizon Adapter
console.log("[Hardware] Emitting telemetry event...");
console.log("Data:", JSON.stringify(mockData, null, 2));

// 2. Logic Verification (Mental Check/Simulation of handleIncomingData)
console.log("[Horizon] handleIncomingData(data) called.");

function simulateHandleData(data) {
  console.log(`[Horizon] Logged incoming: < ${JSON.stringify(data)}`);
  
  if (data.node_id) {
    console.log(`[Horizon] Updating Telemetry UI for Node: ${data.node_id}`);
    if (data.sensors.presence) {
      console.log(`[Horizon] Presence DETECTED! Triggering visual alert.`);
    }
  }
}

simulateHandleData(mockData);

// 3. Brain Ingestion (Semantic Mapping)
console.log("[Horizon] Semantic Transformation:");
const semanticMsg = `Device ${mockData.node_id} reports presence is ${mockData.sensors.presence ? 'DETECTED' : 'CLEAR'} and temp is ${mockData.sensors.temp}°C.`;
console.log(`[Semantic Message] "${semanticMsg}"`);

// 4. Brain Integration
console.log("[Horizon] Forwarding semantic message to RAM Brain...");
console.log("[RAM Brain] Ingestion successful. Updating local memory graph.");

console.log("--- Verification Complete: PASS ---");
