import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assumed path to the built CLI entrypoint
const CLI_PATH = path.resolve(__dirname, '../../CLI/build.js');

export async function runCLITask(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const cliProcess = spawn('node', [CLI_PATH, '--headless'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    cliProcess.on('message', (message: any) => {
      // You can adjust this condition based on the exact expected payload shape from the CLI
      if (message && message.query === query) {
        resolve(message);
        cliProcess.kill();
      }
    });

    cliProcess.on('error', (err) => {
      reject(err);
    });

    cliProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`CLI process exited with code ${code}`));
      }
    });

    // Send the query to the CLI process via IPC
    cliProcess.send({ type: 'run', query });
  });
}
