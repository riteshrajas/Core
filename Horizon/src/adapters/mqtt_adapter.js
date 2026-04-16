import { TransportAdapter } from './transport_adapter.js';

/**
 * MQTT.js Adapter for Apex MiniMax nodes.
 */
export class MqttAdapter extends TransportAdapter {
  /**
   * Initializes a new MqttAdapter.
   */
  constructor() {
    super();
    this.client = null;
    this.topic = 'apex/telemetry/#';
    this.commandTopic = 'apex/commands';
  }

  /**
   * Connects to an MQTT broker.
   * @param {string} endpoint The broker address.
   * @return {Promise<void>}
   */
  async connect(endpoint) {
    if (!window.mqtt) {
      throw new Error('MQTT.js library not loaded.');
    }

    this.emitStatus('connecting');
    this.client = window.mqtt.connect(endpoint);

    this.client.on('connect', () => {
      this.emitStatus('connected');
      this.client.subscribe(this.topic);
    });

    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        this.emitData({ topic, ...data });
      } catch {
        console.warn('Malformed JSON received via MQTT:', message.toString());
      }
    });

    this.client.on('error', () => {
      this.emitStatus('error');
    });

    this.client.on('close', () => {
      this.emitStatus('disconnected');
    });
  }

  /**
   * Disconnects the MQTT client.
   * @return {Promise<void>}
   */
  async disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    this.emitStatus('disconnected');
  }

  /**
   * Publishes a payload to the command topic.
   * @param {Object} payload The data to send.
   * @return {Promise<void>}
   */
  async send(payload) {
    if (!this.client) {
      throw new Error('Not connected.');
    }

    this.client.publish(this.commandTopic, JSON.stringify(payload));
  }
}
