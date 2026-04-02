import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const serverDir = path.join(rootDir, "pipecat-bot", "server");
const venvPython = path.join(serverDir, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");

const child = spawn(venvPython, ["bot.py"], {
  cwd: serverDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONUTF8: "1"
  }
});

child.on("error", (error) => {
  console.error("Failed to start Pipecat server.", error);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

if (!existsSync(venvPython)) {
  console.error("Pipecat server venv missing. Run: npm run init:one");
  process.exit(1);
}
