import { SerialAdapter } from './adapters/SerialAdapter.js';
import { MqttAdapter } from './adapters/MqttAdapter.js';
import { CloudAdapter } from './adapters/CloudAdapter.js';

/**
 * Apex Horizon - Universal Node Controller
 * Handles Serial (L1), MQTT (L2), and Cloud (L3) nodes.
 */

const FIRMWARE_TARGETS = {
  1: { repo: "riteshrajas/APEX-MicroMax", label: "Level 1 (Wired)" },
  2: { repo: "riteshrajas/APEX-MiniMax", label: "Level 2 (WiFi)" },
  3: { repo: "riteshrajas/APEX-MegaMax", label: "Level 3 (LTE)" },
};

const DEFAULT_SCOPES = [
  {
    id: crypto.randomUUID(),
    name: "Primary Workspace",
    level: "1",
    transport: "serial",
    endpoint: "COM4",
    notes: "MicroMax workstation node",
  },
  {
    id: crypto.randomUUID(),
    name: "Living Room Sentry",
    level: "2",
    transport: "mqtt",
    endpoint: "ws://192.168.1.50:9001",
    notes: "MiniMax ambient node",
  }
];

const state = {
  scopes: loadScopes(),
  selectedScopeId: null,
  adapter: null,
  connection: {
    status: 'disconnected',
  },
  telemetry: {},
  nodeId: "HORIZON-VIRTUAL-01",
};

const els = {};

window.addEventListener("DOMContentLoaded", init);

function init() {
  bindElements();
  wireEvents();
  state.selectedScopeId = state.scopes[0]?.id ?? null;
  render();
  checkCapabilities();
}

function bindElements() {
  const ids = [
    "device-list", "device-name", "device-level", "device-transport",
    "save-device", "remove-device", "add-device",
    "browser-support", "connection-status", "transport-chip",
    "authorize-port", "reconnect-port", "disconnect-port",
    "endpoint-addr", "bound-scope", "protocol-label", "node-id", "node-latency",
    "role-select", "apply-role", "relay-1", "relay-2", "servo-angle", "apply-servo",
    "semantic-input", "apply-semantic", "raw-json", "send-raw-json", "toggle-auto-poll",
    "telemetry-role", "telemetry-uptime", "telemetry-temp", "telemetry-humidity",
    "telemetry-lux", "telemetry-presence", "telemetry-signal", "telemetry-battery",
    "flash-level", "flash-repo", "flash-port", "copy-flash-command", "ota-update",
    "clear-log", "log-output", "device-item-template"
  ];
  ids.forEach(id => els[id] = document.getElementById(id));
}

function wireEvents() {
  els["add-device"].addEventListener("click", addScope);
  els["save-device"].addEventListener("click", saveSelectedScope);
  els["remove-device"].addEventListener("click", removeSelectedScope);
  els["authorize-port"].addEventListener("click", connectNode);
  els["disconnect-port"].addEventListener("click", disconnectNode);
  els["apply-semantic"].addEventListener("click", handleSemanticInference);
  els["send-raw-json"].addEventListener("click", sendRawJson);
  els["clear-log"].addEventListener("click", () => els["log-output"].textContent = "");
  
  els["relay-1"].addEventListener("click", () => sendPayload({ action: "TOGGLE_RELAY", index: 1 }));
  els["relay-2"].addEventListener("click", () => sendPayload({ action: "TOGGLE_RELAY", index: 2 }));
  els["apply-servo"].addEventListener("click", () => sendPayload({ action: "SET_SERVO", angle: parseInt(els["servo-angle"].value) }));
  els["apply-role"].addEventListener("click", () => sendPayload({ action: "SET_ROLE", role: els["role-select"].value }));

  // Generic quick actions
  document.querySelectorAll(".quick-command, .quick-query").forEach(btn => {
    btn.addEventListener("click", () => {
      const payload = btn.dataset.command ? { command: btn.dataset.command } : { query: btn.dataset.query };
      sendPayload(payload);
    });
  });
}

function loadScopes() {
  const raw = localStorage.getItem("apex-horizon-scopes");
  return raw ? JSON.parse(raw) : DEFAULT_SCOPES;
}

function persistScopes() {
  localStorage.setItem("apex-horizon-scopes", JSON.stringify(state.scopes));
}

function getSelectedScope() {
  return state.scopes.find(s => s.id === state.selectedScopeId) ?? null;
}

function render() {
  renderScopeList();
  const scope = getSelectedScope();
  if (scope) {
    els["device-name"].value = scope.name;
    els["device-level"].value = scope.level;
    els["device-transport"].value = scope.transport;
    els["endpoint-addr"].value = scope.endpoint;
    
    const target = FIRMWARE_TARGETS[scope.level];
    els["flash-level"].textContent = target.label;
    els["flash-repo"].textContent = target.repo;
    els["transport-chip"].textContent = `Transport: ${scope.transport.toUpperCase()}`;
  }
}

function renderScopeList() {
  els["device-list"].innerHTML = "";
  state.scopes.forEach(scope => {
    const node = els["device-item-template"].content.firstElementChild.cloneNode(true);
    node.querySelector(".device-name").textContent = scope.name;
    node.querySelector(".device-meta").textContent = `Level ${scope.level} • ${scope.transport}`;
    if (scope.id === state.selectedScopeId) node.classList.add("active");
    node.addEventListener("click", () => {
      state.selectedScopeId = scope.id;
      render();
    });
    els["device-list"].appendChild(node);
  });
}

function checkCapabilities() {
  const hasSerial = "serial" in navigator;
  els["browser-support"].textContent = hasSerial ? "Web Serial Ready" : "Web Serial Unavailable";
  els["browser-support"].className = `status-chip ${hasSerial ? 'ok' : 'warn'}`;
}

async function connectNode() {
  const scope = getSelectedScope();
  if (!scope) return;
  
  if (state.adapter) {
    await state.adapter.disconnect();
  }

  log(`Initializing ${scope.transport} adapter for ${scope.name}...`);

  switch (scope.transport) {
    case 'serial':
      state.adapter = new SerialAdapter();
      break;
    case 'mqtt':
      state.adapter = new MqttAdapter();
      break;
    case 'cloud':
      state.adapter = new CloudAdapter();
      break;
    default:
      log(`Error: Unsupported transport ${scope.transport}`);
      return;
  }

  state.adapter.onStatusChange = (status) => {
    state.connection.status = status;
    els["connection-status"].textContent = status.charAt(0).toUpperCase() + status.slice(1);
    els["connection-status"].className = `status-chip ${status === 'connected' ? 'ok' : 'warn'}`;
    
    if (status === 'connected') {
      els["bound-scope"].textContent = scope.name;
      els["protocol-label"].textContent = scope.transport === 'serial' ? 'ASP 2.0' : 'ASP 2.0 (Over Network)';
      log(`Connected to ${scope.name} node.`);
    }
  };

  state.adapter.onData = (data) => {
    handleIncomingData(data);
  };

  try {
    await state.adapter.connect(scope.endpoint);
  } catch (e) {
    log(`Connection failed: ${e.message}`);
  }
}

async function disconnectNode() {
  if (state.adapter) {
    await state.adapter.disconnect();
    state.adapter = null;
  }
  log("Node unbound.");
}

function handleIncomingData(data) {
  const msg = JSON.stringify(data);
  log(`< ${msg}`);

  // Update Telemetry HUD
  if (data.node_id) {
    els["node-id"].textContent = data.node_id;
    state.telemetry[data.node_id] = { ...state.telemetry[data.node_id], ...data };
    updateTelemetryUI(data);
  }

  if (data.timestamp) {
    const latency = Date.now() - new Date(data.timestamp).getTime();
    els["node-latency"].textContent = `${latency} ms`;
  }
}

function updateTelemetryUI(data) {
  if (data.role) els["telemetry-role"].textContent = data.role;
  if (data.uptime) els["telemetry-uptime"].textContent = `${data.uptime}s`;
  if (data.sensors) {
    if (data.sensors.temp !== undefined) els["telemetry-temp"].textContent = `${data.sensors.temp}°C`;
    if (data.sensors.humidity !== undefined) els["telemetry-humidity"].textContent = `${data.sensors.humidity}%`;
    if (data.sensors.lux !== undefined) els["telemetry-lux"].textContent = `${data.sensors.lux}lx`;
    if (data.sensors.presence !== undefined) {
      els["telemetry-presence"].textContent = data.sensors.presence ? "DETECTED" : "CLEAR";
      els["telemetry-presence"].parentElement.style.backgroundColor = data.sensors.presence ? "rgba(255, 0, 0, 0.1)" : "transparent";
    }
  }
  if (data.signal !== undefined) els["telemetry-signal"].textContent = `${data.signal}dBm`;
  if (data.battery !== undefined) els["telemetry-battery"].textContent = `${data.battery}%`;
}

async function handleSemanticInference() {
  const input = els["semantic-input"].value.trim();
  if (!input) return;
  
  log(`[Brain Inference] Parsing: "${input}"`);
  
  // Simulation of semantic parsing
  // In a real scenario, this would send the string to a backend (like RAM Brain)
  // which would return a set of ASP commands.
  
  let commands = [];
  if (input.toLowerCase().includes("red")) {
    commands.push({ action: "SET_RGB", r: 255, g: 0, b: 0 });
  }
  if (input.toLowerCase().includes("alert")) {
    commands.push({ action: "SET_STATE", value: "ALERT" });
  }
  
  if (commands.length > 0) {
    log(`[Brain Inference] Mapped to ${commands.length} commands.`);
    for (const cmd of commands) {
      await sendPayload(cmd);
    }
  } else {
    log(`[Brain Inference] No direct hardware mapping found. Passing to LLM...`);
    // Example: send to RAM Brain
    sendPayload({ action: "INFERENCE", prompt: input });
  }
}

async function sendPayload(payload) {
  if (state.connection.status !== 'connected' || !state.adapter) {
    log("Error: Not connected to a node.");
    return;
  }
  
  // Add metadata to payload
  const enrichedPayload = {
    ...payload,
    origin: "HORIZON",
    timestamp: new Date().toISOString()
  };

  const msg = JSON.stringify(enrichedPayload);
  log(`> ${msg}`);
  
  try {
    await state.adapter.send(enrichedPayload);
  } catch (e) {
    log(`Send failed: ${e.message}`);
  }
}

function sendRawJson() {
  try {
    const payload = JSON.parse(els["raw-json"].value);
    sendPayload(payload);
  } catch (e) {
    alert("Invalid JSON payload.");
  }
}

function addScope() {
  const scope = {
    id: crypto.randomUUID(),
    name: "New Horizon Node",
    level: "1",
    transport: "serial",
    endpoint: "",
    notes: "",
  };
  state.scopes.push(scope);
  state.selectedScopeId = scope.id;
  persistScopes();
  render();
}

function saveSelectedScope() {
  const scope = getSelectedScope();
  if (!scope) return;
  scope.name = els["device-name"].value;
  scope.level = els["device-level"].value;
  scope.transport = els["device-transport"].value;
  scope.endpoint = els["endpoint-addr"].value;
  persistScopes();
  render();
  log(`Scope "${scope.name}" updated.`);
}

function removeSelectedScope() {
  state.scopes = state.scopes.filter(s => s.id !== state.selectedScopeId);
  state.selectedScopeId = state.scopes[0]?.id ?? null;
  persistScopes();
  render();
}

function log(msg) {
  const now = new Date().toLocaleTimeString();
  els["log-output"].textContent += `[${now}] ${msg}\n`;
  els["log-output"].scrollTop = els["log-output"].scrollHeight;
}
