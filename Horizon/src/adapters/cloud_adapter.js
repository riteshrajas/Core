import { TransportAdapter } from './transport_adapter.js';

/**
 * WebSocket Adapter for Apex Cloud nodes.
 */
export class CloudAdapter extends TransportAdapter {
  /**
   * Initializes a new CloudAdapter.
   */
  constructor() {
    super();
    this.socket = null;
  }

  /**
   * Connects to a WebSocket endpoint.
   * @param {string} endpoint The socket address.
   * @return {Promise<void>}
   */
  async connect(endpoint) {
    this.emitStatus('connecting');
    this.socket = new WebSocket(endpoint);

    this.socket.onopen = () => {
      this.emitStatus('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        this.emitData(JSON.parse(event.data));
      } catch {
        console.warn('Malformed JSON received via WebSocket:', event.data);
      }
    };

    this.socket.onerror = () => {
      this.emitStatus('error');
    };

    this.socket.onclose = () => {
      this.emitStatus('disconnected');
    };
  }

  /**
   * Disconnects the socket.
   * @return {Promise<void>}
   */
  async disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.emitStatus('disconnected');
  }

  /**
   * Sends a payload via WebSocket.
   * @param {Object} payload The data to send.
   * @return {Promise<void>}
   */
  async send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected.');
    }

    this.socket.send(JSON.stringify(payload));
  }
}
