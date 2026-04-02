import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Spawns the python pipecat server, acting like `npm run pipecat:server`
 * Return the child process so it can be monitored or killed later.
 */
export function spawnPipecatServer(): ChildProcess {
  // `npm run pipecat:server` invokes node scripts/pipecat-server.mjs
  // We'll spawn that same mjs wrapper script directly for consistency
  const pipecatRunnerPath = path.resolve(__dirname, '../scripts/pipecat-server.mjs');

  const pipecatProcess = spawn('node', [pipecatRunnerPath], {
    stdio: 'inherit',
    detached: false
  });

  return pipecatProcess;
}
