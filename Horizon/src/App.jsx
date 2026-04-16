import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SerialAdapter } from './adapters/serial_adapter.js';
import { MqttAdapter } from './adapters/mqtt_adapter.js';
import { CloudAdapter } from './adapters/cloud_adapter.js';

const FIRMWARE_TARGETS = {
  1: { repo: 'riteshrajas/APEX-MicroMax', label: 'Level 1 (Wired)' },
  2: { repo: 'riteshrajas/APEX-MiniMax', label: 'Level 2 (WiFi)' },
  3: { repo: 'riteshrajas/APEX-MegaMax', label: 'Level 3 (LTE)' },
};

const DEFAULT_SCOPES = [
  {
    id: 'scope-primary',
    name: 'Primary Workspace',
    level: '1',
    transport: 'serial',
    endpoint: 'COM4',
    notes: 'MicroMax workstation node',
  },
  {
    id: 'scope-living-room',
    name: 'Living Room Sentry',
    level: '2',
    transport: 'mqtt',
    endpoint: 'ws://192.168.1.50:9001',
    notes: 'MiniMax ambient node',
  },
];

const AUTO_POLL_INTERVAL_MS = 5000;

/**
 * Loads node scopes from local storage.
 * @return {Array}
 */
function loadScopes() {
  const raw = localStorage.getItem('apex-horizon-scopes');
  if (!raw) {
    return DEFAULT_SCOPES;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_SCOPES;
    }
    return parsed;
  } catch {
    return DEFAULT_SCOPES;
  }
}

/**
 * Returns formatted current time string.
 * @return {string}
 */
function formatNow() {
  return new Date().toLocaleTimeString();
}

/**
 * Returns CSS class for connection status.
 * @param {string} status The status string.
 * @return {string}
 */
function statusClass(status) {
  if (status === 'connected') {
    return 'status-chip ok';
  }
  if (status === 'error') {
    return 'status-chip bad';
  }
  return 'status-chip warn';
}

/**
 * Apex Horizon Main Application Component.
 * @return {JSX.Element}
 */
export default function App() {
  const [scopes, setScopes] = useState(loadScopes);
  const [selectedScopeId, setSelectedScopeId] = useState(() => loadScopes()[0]?.id ?? null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceLevel, setDeviceLevel] = useState('1');
  const [deviceTransport, setDeviceTransport] = useState('serial');
  const [endpointAddr, setEndpointAddr] = useState('');
  const [flashPort, setFlashPort] = useState('');
  const [semanticInput, setSemanticInput] = useState('');
  const [rawJson, setRawJson] = useState('{ "query": "GET_STATUS" }');
  const [role, setRole] = useState('reflex');
  const [servoAngle, setServoAngle] = useState(90);
  const [logs, setLogs] = useState([]);
  const [browserSupport, setBrowserSupport] = useState({
    text: 'Checking capabilities...',
    className: 'status-chip warn',
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [boundScope, setBoundScope] = useState('-');
  const [nodeId, setNodeId] = useState('-');
  const [nodeLatency, setNodeLatency] = useState('- ms');
  const [protocolLabel, setProtocolLabel] = useState('-');
  const [autoPollEnabled, setAutoPollEnabled] = useState(false);
  const [telemetry, setTelemetry] = useState({
    role: '-',
    uptime: '-',
    temp: '-',
    humidity: '-',
    lux: '-',
    presence: '-',
    signal: '-',
    battery: '-',
  });

  const adapterRef = useRef(null);
  const autoPollRef = useRef(null);

  const selectedScope = useMemo(
    () => scopes.find((scope) => scope.id === selectedScopeId) ?? null,
    [scopes, selectedScopeId]
  );
  const flashTarget = FIRMWARE_TARGETS[Number(selectedScope?.level ?? '1')];

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, `[${formatNow()}] ${message}`]);
  }, []);

  const updateTelemetryUI = useCallback((data) => {
    setTelemetry((prev) => {
      const next = { ...prev };
      if (data.role !== undefined) {
        next.role = String(data.role);
      }
      if (data.uptime !== undefined) {
        next.uptime = `${data.uptime}s`;
      }
      if (data.sensors) {
        if (data.sensors.temp !== undefined) {
          next.temp = `${data.sensors.temp} degC`;
        }
        if (data.sensors.humidity !== undefined) {
          next.humidity = `${data.sensors.humidity}%`;
        }
        if (data.sensors.lux !== undefined) {
          next.lux = `${data.sensors.lux} lx`;
        }
        if (data.sensors.presence !== undefined) {
          next.presence = data.sensors.presence ? 'DETECTED' : 'CLEAR';
        }
      }
      if (data.signal !== undefined) {
        next.signal = `${data.signal} dBm`;
      }
      if (data.battery !== undefined) {
        next.battery = `${data.battery}%`;
      }
      return next;
    });
  }, []);

  const handleIncomingData = useCallback(
    (data) => {
      addLog(`< ${JSON.stringify(data)}`);

      if (data.node_id) {
        setNodeId(data.node_id);
      }

      if (data.timestamp) {
        const latencyMs = Date.now() - new Date(data.timestamp).getTime();
        setNodeLatency(`${latencyMs} ms`);
      }

      updateTelemetryUI(data);
    },
    [addLog, updateTelemetryUI]
  );

  const sendPayload = useCallback(
    async (payload) => {
      if (!adapterRef.current || connectionStatus !== 'connected') {
        addLog('Error: Not connected to a node.');
        return;
      }

      const enrichedPayload = {
        ...payload,
        origin: 'HORIZON',
        timestamp: new Date().toISOString(),
      };

      addLog(`> ${JSON.stringify(enrichedPayload)}`);
      try {
        await adapterRef.current.send(enrichedPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`Send failed: ${message}`);
      }
    },
    [addLog, connectionStatus]
  );

  const disconnectNode = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.disconnect();
      adapterRef.current = null;
    }

    setConnectionStatus('disconnected');
    setBoundScope('-');
    setProtocolLabel('-');
    addLog('Node unbound.');
  }, [addLog]);

  const connectNode = useCallback(async () => {
    if (!selectedScope) {
      return;
    }

    const activeScope = {
      ...selectedScope,
      name: deviceName || selectedScope.name,
      level: deviceLevel || selectedScope.level,
      transport: deviceTransport || selectedScope.transport,
      endpoint: endpointAddr || selectedScope.endpoint,
    };

    if (adapterRef.current) {
      await disconnectNode();
    }

    addLog(`Initializing ${activeScope.transport} adapter for ${activeScope.name}...`);

    let adapter;
    if (activeScope.transport === 'serial') {
      adapter = new SerialAdapter();
    } else if (activeScope.transport === 'mqtt') {
      adapter = new MqttAdapter();
    } else if (activeScope.transport === 'cloud') {
      adapter = new CloudAdapter();
    } else {
      addLog(`Error: Unsupported transport ${activeScope.transport}`);
      return;
    }

    adapter.onStatusChange = (status) => {
      setConnectionStatus(status);
      if (status === 'connected') {
        setBoundScope(activeScope.name);
        setProtocolLabel(
          activeScope.transport === 'serial' ? 'ASP 2.0' : 'ASP 2.0 (Over Network)'
        );
        addLog(`Connected to ${activeScope.name} node.`);
      }
    };
    adapter.onData = handleIncomingData;

    try {
      await adapter.connect(activeScope.endpoint);
      adapterRef.current = adapter;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionStatus('error');
      addLog(`Connection failed: ${message}`);
    }
  }, [
    addLog,
    deviceLevel,
    deviceName,
    deviceTransport,
    disconnectNode,
    endpointAddr,
    handleIncomingData,
    selectedScope,
  ]);

  const reconnectNode = useCallback(async () => {
    await disconnectNode();
    await connectNode();
  }, [connectNode, disconnectNode]);

  const handleSemanticInference = useCallback(async () => {
    const input = semanticInput.trim();
    if (!input) {
      return;
    }

    addLog(`[Brain Inference] Parsing: "${input}"`);
    const commands = [];
    const lowered = input.toLowerCase();
    if (lowered.includes('red')) {
      commands.push({ action: 'SET_RGB', r: 255, g: 0, b: 0 });
    }
    if (lowered.includes('alert')) {
      commands.push({ action: 'SET_STATE', value: 'ALERT' });
    }

    if (commands.length > 0) {
      addLog(`[Brain Inference] Mapped to ${commands.length} commands.`);
      for (const command of commands) {
        await sendPayload(command);
      }
      return;
    }

    addLog('[Brain Inference] No direct mapping found. Forwarding prompt.');
    await sendPayload({ action: 'INFERENCE', prompt: input });
  }, [addLog, semanticInput, sendPayload]);

  const handleRawJsonSend = useCallback(async () => {
    try {
      const payload = JSON.parse(rawJson);
      await sendPayload(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`Invalid JSON payload: ${message}`);
    }
  }, [addLog, rawJson, sendPayload]);

  const saveSelectedScope = useCallback(() => {
    if (!selectedScopeId) {
      return;
    }

    setScopes((prev) =>
      prev.map((scope) =>
        scope.id === selectedScopeId
          ? {
              ...scope,
              name: deviceName,
              level: deviceLevel,
              transport: deviceTransport,
              endpoint: endpointAddr,
            }
          : scope
      )
    );
    addLog(`Scope "${deviceName}" updated.`);
  }, [addLog, deviceLevel, deviceName, deviceTransport, endpointAddr, selectedScopeId]);

  const addScope = useCallback(() => {
    const scope = {
      id: crypto.randomUUID(),
      name: 'New Horizon Node',
      level: '1',
      transport: 'serial',
      endpoint: '',
      notes: '',
    };
    setScopes((prev) => [...prev, scope]);
    setSelectedScopeId(scope.id);
  }, []);

  const removeSelectedScope = useCallback(() => {
    if (!selectedScopeId) {
      return;
    }

    setScopes((prev) => {
      const filtered = prev.filter((scope) => scope.id !== selectedScopeId);
      const nextSelection = filtered[0]?.id ?? null;
      setSelectedScopeId(nextSelection);
      return filtered;
    });
  }, [selectedScopeId]);

  const copyFlashLogic = useCallback(async () => {
    const targetLevel = Number(deviceLevel);
    const port = (flashPort || endpointAddr || 'COM4').trim();
    let command = '';
    if (targetLevel === 1) {
      command = `cd P:\\APEX\\MicroMax\\OS && platformio run -e uno -t upload --upload-port ${port}`;
    } else if (targetLevel === 2) {
      command = `echo OTA for Level 2 via ${port}`;
    } else {
      command = `echo OTA for Level 3 via ${port}`;
    }

    try {
      await navigator.clipboard.writeText(command);
      addLog(`Flash logic copied: ${command}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`Copy failed: ${message}`);
    }
  }, [addLog, deviceLevel, endpointAddr, flashPort]);

  const triggerOta = useCallback(() => {
    addLog('OTA trigger queued for selected scope.');
  }, [addLog]);

  useEffect(() => {
    localStorage.setItem('apex-horizon-scopes', JSON.stringify(scopes));
  }, [scopes]);

  useEffect(() => {
    if (!selectedScope) {
      setDeviceName('');
      setDeviceLevel('1');
      setDeviceTransport('serial');
      setEndpointAddr('');
      return;
    }

    setDeviceName(selectedScope.name);
    setDeviceLevel(selectedScope.level);
    setDeviceTransport(selectedScope.transport);
    setEndpointAddr(selectedScope.endpoint);
    setFlashPort(selectedScope.endpoint);
  }, [selectedScope]);

  useEffect(() => {
    const hasSerial = 'serial' in navigator;
    setBrowserSupport({
      text: hasSerial ? 'Web Serial Ready' : 'Web Serial Unavailable',
      className: hasSerial ? 'status-chip ok' : 'status-chip warn',
    });
  }, []);

  useEffect(() => {
    if (!autoPollEnabled || connectionStatus !== 'connected') {
      if (autoPollRef.current) {
        window.clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
      return undefined;
    }

    autoPollRef.current = window.setInterval(() => {
      void sendPayload({ query: 'GET_TELEMETRY' });
    }, AUTO_POLL_INTERVAL_MS);

    return () => {
      if (autoPollRef.current) {
        window.clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  }, [autoPollEnabled, connectionStatus, sendPayload]);

  useEffect(() => {
    return () => {
      if (autoPollRef.current) {
        window.clearInterval(autoPollRef.current);
      }
      if (adapterRef.current) {
        void adapterRef.current.disconnect();
        adapterRef.current = null;
      }
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Apex Ecosystem</p>
          <h1>Horizon</h1>
          <p className="muted-copy">
            Universal node control, multi-level telemetry, and global firmware orchestration.
          </p>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Node Scopes</h2>
            <button type="button" onClick={addScope} className="button secondary">
              Add
            </button>
          </div>
          <div className="device-list">
            {scopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                className={`device-item ${scope.id === selectedScopeId ? 'active' : ''}`}
                onClick={() => setSelectedScopeId(scope.id)}
              >
                <span className="device-name">{scope.name}</span>
                <span className="device-meta">
                  Level {scope.level} | {scope.transport}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel compact">
          <h2>Active Scope</h2>
          <label className="field">
            <span>Level</span>
            <select value={deviceLevel} onChange={(event) => setDeviceLevel(event.target.value)}>
              <option value="1">Level 1 (MicroMax - Wired)</option>
              <option value="2">Level 2 (MiniMax - WiFi/MQTT)</option>
              <option value="3">Level 3 (MegaMax - Global LTE)</option>
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              placeholder="Workspace Sentry 01"
              value={deviceName}
              onChange={(event) => setDeviceName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Transport</span>
            <select
              value={deviceTransport}
              onChange={(event) => setDeviceTransport(event.target.value)}
            >
              <option value="serial">Web Serial (USB)</option>
              <option value="mqtt">Local MQTT (WiFi)</option>
              <option value="cloud">Apex Cloud (LTE)</option>
            </select>
          </label>
          <div className="inline-actions">
            <button type="button" onClick={saveSelectedScope} className="button primary">
              Save Scope
            </button>
            <button type="button" onClick={removeSelectedScope} className="button destructive">
              Delete
            </button>
          </div>
        </section>
      </aside>

      <main className="main-grid">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Universal Orchestration Surface</p>
            <h2>Horizon Terminal</h2>
            <p className="muted-copy">
              Orchestrate wired, wireless, and global nodes from a single dashboard.
            </p>
          </div>
          <div className="status-strip">
            <div className={browserSupport.className}>{browserSupport.text}</div>
            <div className={statusClass(connectionStatus)}>
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </div>
            <div className="status-chip">
              Transport: {selectedScope?.transport?.toUpperCase() ?? '-'}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Connection Engine</h3>
            <p className="muted-copy">Bind local port, MQTT broker, or cloud socket.</p>
          </div>
          <div className="grid two">
            <div className="stack">
              <div className="inline-actions">
                <button type="button" onClick={connectNode} className="button primary">
                  Bind Node
                </button>
                <button type="button" onClick={reconnectNode} className="button secondary">
                  Reconnect
                </button>
                <button type="button" onClick={disconnectNode} className="button secondary">
                  Disconnect
                </button>
              </div>
              <label className="field">
                <span>Endpoint / Address</span>
                <input
                  type="text"
                  placeholder="COM4 or 192.168.1.100"
                  value={endpointAddr}
                  onChange={(event) => setEndpointAddr(event.target.value)}
                />
              </label>
            </div>
            <div className="metrics">
              <div className="metric">
                <span className="metric-label">Active Node</span>
                <strong>{boundScope}</strong>
              </div>
              <div className="metric">
                <span className="metric-label">Protocol</span>
                <strong>{protocolLabel}</strong>
              </div>
              <div className="metric">
                <span className="metric-label">Node ID</span>
                <strong>{nodeId}</strong>
              </div>
              <div className="metric">
                <span className="metric-label">Latency</span>
                <strong>{nodeLatency}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Interaction &amp; Inference</h3>
            <p className="muted-copy">ASP-compatible payloads for command and telemetry flow.</p>
          </div>
          <div className="grid three">
            <div className="command-cluster">
              <h4>Common Queries</h4>
              <div className="inline-actions wrap">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ command: 'ping' })}
                >
                  Ping
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ query: 'WHO_ARE_YOU' })}
                >
                  Identity
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ query: 'GET_STATUS' })}
                >
                  Status
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ query: 'GET_TELEMETRY' })}
                >
                  Telemetry
                </button>
              </div>
              <label className="field">
                <span>Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="reflex">reflex</option>
                  <option value="sentry">sentry</option>
                  <option value="action">action</option>
                </select>
              </label>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void sendPayload({ action: 'SET_ROLE', role })}
                >
                  Set Role
                </button>
              </div>
            </div>

            <div className="command-cluster">
              <h4>Physical Actuators</h4>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ action: 'TOGGLE_RELAY', index: 1 })}
                >
                  Relay 1
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendPayload({ action: 'TOGGLE_RELAY', index: 2 })}
                >
                  Relay 2
                </button>
              </div>
              <label className="field">
                <span>Servo Angle</span>
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={servoAngle}
                  onChange={(event) => setServoAngle(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                className="button primary"
                onClick={() => void sendPayload({ action: 'SET_SERVO', angle: servoAngle })}
              >
                Apply Servo
              </button>
            </div>

            <div className="command-cluster">
              <h4>Global Inference</h4>
              <label className="field">
                <span>Semantic Command</span>
                <textarea
                  rows="3"
                  value={semanticInput}
                  onChange={(event) => setSemanticInput(event.target.value)}
                  placeholder="Set living room lights to red and alert if temperature exceeds 30"
                />
              </label>
              <button type="button" className="button primary" onClick={() => void handleSemanticInference()}>
                Inference Execution
              </button>
              <label className="field">
                <span>Raw ASP JSON</span>
                <textarea
                  rows="3"
                  value={rawJson}
                  onChange={(event) => setRawJson(event.target.value)}
                />
              </label>
              <button type="button" className="button secondary" onClick={() => void handleRawJsonSend()}>
                Send Payload
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Telemetry Feed</h3>
            <div className="inline-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAutoPollEnabled((prev) => !prev)}
              >
                {autoPollEnabled ? 'Stop Auto Poll' : 'Start Auto Poll'}
              </button>
            </div>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-cell">
              <span>Role</span>
              <strong>{telemetry.role}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Uptime</span>
              <strong>{telemetry.uptime}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Temp</span>
              <strong>{telemetry.temp}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Humidity</span>
              <strong>{telemetry.humidity}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Lux</span>
              <strong>{telemetry.lux}</strong>
            </div>
            <div
              className="telemetry-cell"
              style={{
                backgroundColor: telemetry.presence === 'DETECTED' ? 'rgba(255, 0, 0, 0.1)' : undefined,
              }}
            >
              <span>Presence</span>
              <strong>{telemetry.presence}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Signal</span>
              <strong>{telemetry.signal}</strong>
            </div>
            <div className="telemetry-cell">
              <span>Battery</span>
              <strong>{telemetry.battery}</strong>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Omni-Flasher Tooling</h3>
            <p className="muted-copy">Dynamic firmware orchestration for all node levels.</p>
          </div>
          <div className="grid two">
            <div className="stack">
              <div className="metric">
                <span className="metric-label">Target Level</span>
                <strong>{flashTarget?.label ?? '-'}</strong>
              </div>
              <div className="metric">
                <span className="metric-label">Repo Source</span>
                <strong>{flashTarget?.repo ?? '-'}</strong>
              </div>
              <div className="metric">
                <span className="metric-label">Firmware Ver</span>
                <strong>2.1.0-STABLE</strong>
              </div>
            </div>
            <div className="stack">
              <label className="field">
                <span>Flash Port / IP</span>
                <input
                  type="text"
                  placeholder="COM4 or 192.168.1.50"
                  value={flashPort}
                  onChange={(event) => setFlashPort(event.target.value)}
                />
              </label>
              <div className="inline-actions wrap">
                <button type="button" className="button primary" onClick={() => void copyFlashLogic()}>
                  Generate Flash Logic
                </button>
                <button type="button" className="button secondary" onClick={triggerOta}>
                  OTA Trigger (L2/L3)
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card log-card">
          <div className="card-head">
            <h3>Ecosystem Log</h3>
            <div className="inline-actions">
              <button type="button" className="button secondary" onClick={() => setLogs([])}>
                Clear
              </button>
            </div>
          </div>
          <pre className="log-output">{logs.join('\n')}</pre>
        </section>
      </main>
    </div>
  );
}
