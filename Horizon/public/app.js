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
    endpoint: "192.168.1.50",
    notes: "MiniMax ambient node",
  }
];

const state = {
  scopes: loadScopes(),
  selectedScopeId: null,
  connection: {
    type: null, // 'serial' | 'mqtt' | 'cloud'
    status: 'disconnected',
    port: null,
    socket: null,
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
  
  log(`Attempting to bind ${scope.transport} node at ${scope.endpoint}...`);
  
  // Simulated connection logic
  state.connection.status = 'connected';
  state.connection.type = scope.transport;
  els["connection-status"].textContent = "Connected";
  els["connection-status"].className = "status-chip ok";
  els["bound-scope"].textContent = scope.name;
  els["protocol-label"].textContent = scope.transport === 'serial' ? 'ASP 2.0' : 'MQTT/JSON';
  
  log(`Successfully bound to ${scope.name} node.`);
}

async function disconnectNode() {
  state.connection.status = 'disconnected';
  els["connection-status"].textContent = "Disconnected";
  els["connection-status"].className = "status-chip warn";
  log("Node unbound.");
}

async function handleSemanticInference() {
  const input = els["semantic-input"].value.trim();
  if (!input) return;
  
  log(`[Brain Inference] Parsing: "${input}"`);
  // This would typically call the APEX CLI/RAM API for semantic parsing
  log(`[Brain Inference] Result: Action mapped to SET_RGB and SET_STATE.`);
  
  sendPayload({ action: "SET_STATE", value: "ALERT" });
}

async function sendPayload(payload) {
  if (state.connection.status !== 'connected') {
    alert("Connect to a node first.");
    return;
  }
  const msg = JSON.stringify(payload);
  log(`> ${msg}`);
  // In real implementation: port.write(msg) or mqtt.publish(msg)
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
