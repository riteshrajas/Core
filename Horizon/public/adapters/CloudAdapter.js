import { TransportAdapter } from './TransportAdapter.js';

/**
 * Cloud Adapter for Apex MegaMax nodes via WebSockets.
 */
export class CloudAdapter extends TransportAdapter {
  constructor() {
    super();
    this.socket = null;
  }

  async connect(endpoint) {
    try {
      this.emitStatus('connecting');
      this.socket = new WebSocket(endpoint);

      this.socket.onopen = () => {
        this.emitStatus('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emitData(data);
        } catch (e) {
          console.warn("Malformed JSON received via WebSocket:", event.data);
        }
      };

      this.socket.onerror = (err) => {
        console.error("WebSocket Error:", err);
        this.emitStatus('error');
      };

      this.socket.onclose = () => {
        this.emitStatus('disconnected');
      };
    } catch (e) {
      console.error("WebSocket Connection Failed:", e);
      this.emitStatus('error');
      throw e;
    }
  }

  async disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.emitStatus('disconnected');
  }

  async send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected.");
    }
    this.socket.send(JSON.stringify(payload));
  }
}
