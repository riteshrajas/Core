import { TransportAdapter } from './TransportAdapter.js';

/**
 * Web Serial Adapter for Apex MicroMax nodes.
 */
export class SerialAdapter extends TransportAdapter {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.keepReading = false;
  }

  async connect(endpoint) {
    if (!('serial' in navigator)) {
      throw new Error("Web Serial API not supported by this browser.");
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
      this.readLoop();
      this.emitStatus('connected');
    } catch (e) {
      console.error("Serial Connection Failed:", e);
      this.emitStatus('error');
      throw e;
    }
  }

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

  async send(payload) {
    if (!this.writer) throw new Error("Not connected.");
    const msg = JSON.stringify(payload) + "\n";
    await this.writer.write(msg);
  }

  async readLoop() {
    let buffer = "";
    while (this.keepReading) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep partial line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              this.emitData(data);
            } catch (e) {
              console.warn("Malformed JSON received via Serial:", line);
            }
          }
        }
      } catch (e) {
        if (this.keepReading) {
          console.error("Serial Read Error:", e);
          this.emitStatus('error');
          break;
        }
      }
    }
  }
}
