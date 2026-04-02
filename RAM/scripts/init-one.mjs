import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const pipecatRoot = path.join(rootDir, "pipecat-bot");
const serverDir = path.join(pipecatRoot, "server");
const clientDir = path.join(pipecatRoot, "client");
const cliVenvPython = path.join(rootDir, ".venv-pipecat", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
const serverVenvPython = path.join(serverDir, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");

function main() {
  ensureExists(pipecatRoot, "Pipecat project folder not found: pipecat-bot");
  ensureExists(serverDir, "Pipecat server folder not found: pipecat-bot/server");
  ensureExists(clientDir, "Pipecat client folder not found: pipecat-bot/client");

  run("python", ["--version"], rootDir, "Python must be installed and on PATH.");

  if (!existsSync(cliVenvPython)) {
    run("python", ["-m", "venv", ".venv-pipecat"], rootDir, "Failed creating local Pipecat CLI virtual environment.");
  }

  run(cliVenvPython, ["-m", "pip", "install", "--upgrade", "pip"], rootDir, "Failed upgrading pip in .venv-pipecat.");
  run(cliVenvPython, ["-m", "pip", "install", "pipecat-ai-cli"], rootDir, "Failed installing pipecat-ai-cli.");

  if (!existsSync(serverVenvPython)) {
    run("python", ["-m", "venv", path.join("pipecat-bot", "server", ".venv")], rootDir, "Failed creating Pipecat server virtual environment.");
  }

  run(serverVenvPython, ["-m", "pip", "install", "--upgrade", "pip"], rootDir, "Failed upgrading pip in server venv.");
  run(serverVenvPython, ["-m", "pip", "install", "-e", "."], serverDir, "Failed installing Pipecat server dependencies.");

  runWithRetry(
    "npm",
    ["install"],
    clientDir,
    "Failed installing Pipecat client dependencies.",
    2
  );

  console.log("Apex one-init complete.");
  console.log("Run: npm run dev:interactive");
}

function ensureExists(targetPath, message) {
  if (!existsSync(targetPath)) {
    throw new Error(message);
  }
}

function run(command, args, cwd, failureMessage) {
  const isWindowsNpm = process.platform === "win32" && command === "npm";
  const executable = isWindowsNpm ? "cmd.exe" : command;
  const commandArgs = isWindowsNpm ? ["/d", "/s", "/c", "npm", ...args] : args;

  const result = spawnSync(executable, commandArgs, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      PYTHONUTF8: "1"
    }
  });

  if (result.status !== 0) {
    throw new Error(failureMessage);
  }
}

function runWithRetry(command, args, cwd, failureMessage, maxAttempts) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      run(command, args, cwd, failureMessage);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      console.warn(`Retrying command (${attempt}/${maxAttempts - 1})...`);
    }
  }
}

main();
