import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export type PipecatTarget = "server" | "client" | "all";

type PipecatProcessStatus = {
  running: boolean;
  pid?: number;
  startedAt?: string;
  cwd: string;
  command: string;
};

export type PipecatStatus = {
  integrated: boolean;
  rootDir: string;
  server: PipecatProcessStatus & { venvReady: boolean; envReady: boolean };
  client: PipecatProcessStatus & { packageReady: boolean };
};

export class PipecatManager {
  private readonly rootDir: string;
  private readonly serverDir: string;
  private readonly clientDir: string;
  private readonly serverPython: string;
  private serverProcess: ChildProcess | null = null;
  private clientProcess: ChildProcess | null = null;
  private serverStartedAt: string | undefined;
  private clientStartedAt: string | undefined;
  private readonly serverLogs: string[] = [];
  private readonly clientLogs: string[] = [];

  constructor(projectRoot: string) {
    this.rootDir = path.join(projectRoot, "pipecat-bot");
    this.serverDir = path.join(this.rootDir, "server");
    this.clientDir = path.join(this.rootDir, "client");
    this.serverPython = path.join(
      this.serverDir,
      ".venv",
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python"
    );
  }

  getStatus(): PipecatStatus {
    return {
      integrated: existsSync(this.rootDir),
      rootDir: this.rootDir,
      server: {
        running: this.serverProcess !== null,
        pid: this.serverProcess?.pid,
        startedAt: this.serverStartedAt,
        cwd: this.serverDir,
        command: `${this.serverPython} bot.py`,
        venvReady: existsSync(this.serverPython),
        envReady: existsSync(path.join(this.serverDir, ".env"))
      },
      client: {
        running: this.clientProcess !== null,
        pid: this.clientProcess?.pid,
        startedAt: this.clientStartedAt,
        cwd: this.clientDir,
        command: `${npmCommand()} run dev`,
        packageReady: existsSync(path.join(this.clientDir, "package.json"))
      }
    };
  }

  async start(target: PipecatTarget): Promise<PipecatStatus> {
    this.ensureIntegrated();

    if (target === "server" || target === "all") {
      this.startServer();
    }

    if (target === "client" || target === "all") {
      this.startClient();
    }

    return this.getStatus();
  }

  async stop(target: PipecatTarget): Promise<PipecatStatus> {
    if (target === "server" || target === "all") {
      await this.stopProcess("server");
    }

    if (target === "client" || target === "all") {
      await this.stopProcess("client");
    }

    return this.getStatus();
  }

  getLogs(target: Exclude<PipecatTarget, "all">, lines = 80): string[] {
    const source = target === "server" ? this.serverLogs : this.clientLogs;
    const safeLines = Math.max(1, Math.min(lines, 400));
    return source.slice(-safeLines);
  }

  private startServer() {
    if (this.serverProcess) {
      return;
    }

    if (!existsSync(this.serverPython)) {
      throw new Error("Pipecat server runtime is not initialized. Run `npm run init:one`.");
    }

    const child = spawn(this.serverPython, ["bot.py"], {
      cwd: this.serverDir,
      env: {
        ...process.env,
        PYTHONUTF8: "1"
      }
    });

    this.serverProcess = child;
    this.serverStartedAt = nowIso();
    this.attachLogs(child, "server");
    this.attachLifecycle(child, "server");
  }

  private startClient() {
    if (this.clientProcess) {
      return;
    }

    if (!existsSync(path.join(this.clientDir, "package.json"))) {
      throw new Error("Pipecat client project not found. Run `npm run init:one`.");
    }

    const isWindows = process.platform === "win32";
    const child = spawn(
      isWindows ? "cmd.exe" : npmCommand(),
      isWindows ? ["/d", "/s", "/c", "npm", "run", "dev"] : ["run", "dev"],
      {
      cwd: this.clientDir,
      env: process.env
      }
    );

    this.clientProcess = child;
    this.clientStartedAt = nowIso();
    this.attachLogs(child, "client");
    this.attachLifecycle(child, "client");
  }

  private attachLogs(child: ChildProcess, target: Exclude<PipecatTarget, "all">) {
    const sink = target === "server" ? this.serverLogs : this.clientLogs;
    const pushLines = (chunk: Buffer, stream: "stdout" | "stderr") => {
      const lines = chunk
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);

      for (const line of lines) {
        sink.push(`[${nowIso()}] [${target}] [${stream}] ${line}`);
      }

      if (sink.length > 2000) {
        sink.splice(0, sink.length - 2000);
      }
    };

    child.stdout?.on("data", (chunk) => pushLines(chunk, "stdout"));
    child.stderr?.on("data", (chunk) => pushLines(chunk, "stderr"));
  }

  private attachLifecycle(child: ChildProcess, target: Exclude<PipecatTarget, "all">) {
    child.on("exit", (code, signal) => {
      const sink = target === "server" ? this.serverLogs : this.clientLogs;
      sink.push(`[${nowIso()}] [${target}] process exited (code=${String(code)}, signal=${String(signal)})`);
      if (target === "server") {
        this.serverProcess = null;
        this.serverStartedAt = undefined;
      } else {
        this.clientProcess = null;
        this.clientStartedAt = undefined;
      }
    });

    child.on("error", (error) => {
      const sink = target === "server" ? this.serverLogs : this.clientLogs;
      sink.push(`[${nowIso()}] [${target}] process error: ${error.message}`);
      if (target === "server") {
        this.serverProcess = null;
        this.serverStartedAt = undefined;
      } else {
        this.clientProcess = null;
        this.clientStartedAt = undefined;
      }
    });
  }

  private async stopProcess(target: Exclude<PipecatTarget, "all">): Promise<void> {
    const child = target === "server" ? this.serverProcess : this.clientProcess;
    if (!child) {
      return;
    }

    await terminateChild(child, target);

    if (target === "server") {
      this.serverProcess = null;
      this.serverStartedAt = undefined;
    } else {
      this.clientProcess = null;
      this.clientStartedAt = undefined;
    }
  }

  private ensureIntegrated() {
    if (!existsSync(this.rootDir)) {
      throw new Error("Pipecat integration is missing. Ensure pipecat-bot exists in this workspace.");
    }
  }
}

async function terminateChild(child: ChildProcess, target: Exclude<PipecatTarget, "all">): Promise<void> {
  if (child.killed) {
    return;
  }

  child.kill("SIGINT");
  const exited = await waitForExit(child, 3000);
  if (exited) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
  } else {
    child.kill("SIGTERM");
  }

  const forcedExit = await waitForExit(child, 2000);
  if (!forcedExit) {
    throw new Error(`Failed to stop Pipecat ${target} process.`);
  }
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(false);
      }
    }, timeoutMs);

    child.once("exit", () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function nowIso(): string {
  return new Date().toISOString();
}
