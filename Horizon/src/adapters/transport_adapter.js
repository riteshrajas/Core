/**
 * Base class for Horizon transport adapters.
 */
export class TransportAdapter {
  /**
   * Initializes a new TransportAdapter.
   */
  constructor() {
    this.onData = () => {};
    this.onStatusChange = () => {};
  }

  /**
   * Connects to the endpoint.
   * @param {string} _endpoint The address or port.
   * @return {Promise<void>}
   */
  async connect(_endpoint) {
    throw new Error('connect() not implemented');
  }

  /**
   * Disconnects from the transport.
   * @return {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() not implemented');
  }

  /**
   * Sends a payload.
   * @param {Object} _payload The data to send.
   * @return {Promise<void>}
   */
  async send(_payload) {
    throw new Error('send() not implemented');
  }

  /**
   * Emits incoming data.
   * @param {Object} data The parsed JSON data.
   */
  emitData(data) {
    this.onData(data);
  }

  /**
   * Emits a status change.
   * @param {string} status The new status string.
   */
  emitStatus(status) {
    this.onStatusChange(status);
  }
}
