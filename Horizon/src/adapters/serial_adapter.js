import { TransportAdapter } from './transport_adapter.js';

/**
 * Web Serial Adapter for Apex MicroMax nodes.
 */
export class SerialAdapter extends TransportAdapter {
  /**
   * Initializes a new SerialAdapter.
   */
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.keepReading = false;
  }

  /**
   * Connects to a Web Serial port.
   * @return {Promise<void>}
   */
  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported by this browser.');
    }

    try {
      this.emitStatus('connecting');
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

      this.keepReading = true;
      void this.readLoop();
      this.emitStatus('connected');
    } catch (error) {
      this.emitStatus('error');
      throw error;
    }
  }

  /**
   * Disconnects from the serial port.
   * @return {Promise<void>}
   */
  async disconnect() {
    this.keepReading = false;

    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }

    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.emitStatus('disconnected');
  }

  /**
   * Sends a JSON payload.
   * @param {Object} payload The data to send.
   * @return {Promise<void>}
   */
  async send(payload) {
    if (!this.writer) {
      throw new Error('Not connected.');
    }

    await this.writer.write(`${JSON.stringify(payload)}\n`);
  }

  /**
   * Reads data from the port in a loop.
   */
  async readLoop() {
    let buffer = '';

    while (this.keepReading) {
      try {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          try {
            this.emitData(JSON.parse(line));
          } catch {
            console.warn('Malformed JSON received via Serial:', line);
          }
        }
      } catch {
        if (this.keepReading) {
          this.emitStatus('error');
        }
        break;
      }
    }
  }
}
