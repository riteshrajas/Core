/**
 * Base class for all transport methods in Apex Horizon.
 */
export class TransportAdapter {
  constructor() {
    this.onData = (data) => {};
    this.onStatusChange = (status) => {};
  }

  /**
   * Initialize connection.
   * @param {string} endpoint - The target address (COM port, IP, or URL).
   */
  async connect(endpoint) {
    throw new Error("connect() not implemented");
  }

  /**
   * Terminate connection.
   */
  async disconnect() {
    throw new Error("disconnect() not implemented");
  }

  /**
   * Send data to the node.
   * @param {Object} payload - JSON-compatible object.
   */
  async send(payload) {
    throw new Error("send() not implemented");
  }

  /**
   * Emit data event.
   * @param {Object} data 
   */
  emitData(data) {
    this.onData(data);
  }

  /**
   * Emit status change event.
   * @param {string} status - 'connecting' | 'connected' | 'disconnected' | 'error'
   */
  emitStatus(status) {
    this.onStatusChange(status);
  }
}
