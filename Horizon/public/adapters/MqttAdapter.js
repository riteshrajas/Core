import { TransportAdapter } from './TransportAdapter.js';

/**
 * MQTT Adapter for Apex MiniMax nodes.
 */
export class MqttAdapter extends TransportAdapter {
  constructor() {
    super();
    this.client = null;
    this.topic = "apex/telemetry/#";
    this.commandTopic = "apex/commands";
  }

  async connect(endpoint) {
    if (!window.mqtt) {
      throw new Error("MQTT.js library not loaded.");
    }

    try {
      this.emitStatus('connecting');
      // endpoint should be a ws/wss URL
      this.client = mqtt.connect(endpoint);

      this.client.on('connect', () => {
        this.emitStatus('connected');
        this.client.subscribe(this.topic);
      });

      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          this.emitData({ topic, ...data });
        } catch (e) {
          console.warn("Malformed JSON received via MQTT:", message.toString());
        }
      });

      this.client.on('error', (err) => {
        console.error("MQTT Error:", err);
        this.emitStatus('error');
      });

      this.client.on('close', () => {
        this.emitStatus('disconnected');
      });
    } catch (e) {
      console.error("MQTT Connection Failed:", e);
      this.emitStatus('error');
      throw e;
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    this.emitStatus('disconnected');
  }

  async send(payload) {
    if (!this.client) throw new Error("Not connected.");
    const msg = JSON.stringify(payload);
    this.client.publish(this.commandTopic, msg);
  }
}
