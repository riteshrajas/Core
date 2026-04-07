import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import keyboard;
import mouse;
import time;

const MAX_TOOL_OUTPUT = 6000;

type ToolExecutionResult = {
  name: string;
  output: string;
};

export class ApexToolbox {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async webSearch(query: string): Promise<ToolExecutionResult> {
    const endpoint = new URL("https://api.duckduckgo.com/");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("no_html", "1");
    endpoint.searchParams.set("no_redirect", "1");
    endpoint.searchParams.set("skip_disambig", "1");

    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      throw new Error(`Web search failed with status ${response.status}`);
    }

    const payload = (await response.json()) as DuckDuckGoResponse;
    const lines: string[] = [];

    if (payload.Heading) {
      lines.push(`Heading: ${payload.Heading}`);
    }

    if (payload.AbstractText) {
      lines.push(`Abstract: ${payload.AbstractText}`);
    }

    if (payload.AbstractURL) {
      lines.push(`Source: ${payload.AbstractURL}`);
    }

    const related = flattenRelatedTopics(payload.RelatedTopics).slice(0, 8);
    if (related.length > 0) {
      lines.push("Related:");
      for (const topic of related) {
        lines.push(`- ${topic}`);
      }
    }

    if (lines.length === 0) {
      lines.push("No strong instant answer found. Try a narrower query.");
    }

    return {
      name: "web_search",
      output: clip(lines.join("\n"))
    };
  }

  async fsList(targetPath?: string): Promise<ToolExecutionResult> {
    const resolved = this.resolvePath(targetPath || ".");
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const items = entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`);

    return {
      name: "fs_list",
      output: clip(items.join("\n"))
    };
  }

  async fsRead(targetPath: string): Promise<ToolExecutionResult> {
    const resolved = this.resolvePath(targetPath);
    const text = await fs.readFile(resolved, "utf8");

    return {
      name: "fs_read",
      output: clip(text)
    };
  }

  async fsWrite(targetPath: string, content: string): Promise<ToolExecutionResult> {
    const resolved = this.resolvePath(targetPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf8");

    return {
      name: "fs_write",
      output: `Wrote ${content.length} bytes to ${toRelative(this.rootDir, resolved)}`
    };
  }

  private resolvePath(targetPath: string): string {
    const normalized = targetPath.trim();
    if (normalized.length === 0) {
      throw new Error("Path cannot be empty.");
    }

    const resolved = path.resolve(this.rootDir, normalized);
    const rootWithSep = this.rootDir.endsWith(path.sep) ? this.rootDir : `${this.rootDir}${path.sep}`;

    if (resolved !== this.rootDir && !resolved.startsWith(rootWithSep)) {
      throw new Error("Path escapes the allowed workspace root.");
    }

    return resolved;
  }
}

function flattenRelatedTopics(topics: unknown): string[] {
  if (!Array.isArray(topics)) {
    return [];
  }

  const output: string[] = [];
  for (const topic of topics) {
    if (!topic || typeof topic !== "object") {
      continue;
    }

    const record = topic as Record<string, unknown>;

    if (typeof record.Text === "string") {
      output.push(record.Text);
    }

    if (Array.isArray(record.Topics)) {
      output.push(...flattenRelatedTopics(record.Topics));
    }
  }

  return output;
}

function clip(value: string): string {
  if (value.length <= MAX_TOOL_OUTPUT) {
    return value;
  }
  return `${value.slice(0, MAX_TOOL_OUTPUT)}\n\n[output clipped]`;
}

function toRelative(rootDir: string, fullPath: string): string {
  const relative = path.relative(rootDir, fullPath);
  return relative.length > 0 ? relative : ".";
}

// Note: For keyboard/mouse actions in TS/Node, you'd typically use 
// a library like 'robotjs' or 'nut-js'. I've used 'robot' as a placeholder.
const robot = require('robotjs'); 

/**  Math Tools  **/

export const add = (a: number, b: number): number => a + b;

export const subtract = (a: number, b: number): number => a - b;

export const multiply = (a: number, b: number): number => a * b;

export const divide = (a: number, b: number): number => {
    if (b === 0) throw new Error("Cannot divide by zero");
    return a / b;
};

export const power = (a: number, b: number): number => Math.pow(a, b);

/** --- File System Tools --- **/

export const mkdirs = (dirPath: string): string => {
    fsSync.mkdirSync(dirPath, { recursive: true });
    return `Directory '${dirPath}' created successfully`;
};

export const listFiles = (dirPath: string): string[] => {
    if (!fsSync.existsSync(dirPath)) throw new Error(`Directory '${dirPath}' does not exist`);
    return fsSync.readdirSync(dirPath);
};

export const readFile = (filePath: string): string => {
    if (!fsSync.existsSync(filePath)) throw new Error(`File '${filePath}' does not exist`);
    return fsSync.readFileSync(filePath, 'utf-8');
};

export const makeFile = (filePath: string, content: string): string => {
    fsSync.writeFileSync(filePath, content);
    return `File '${filePath}' created successfully`;
};

export const deleteFile = (filePath: string): string => {
    if (!fsSync.existsSync(filePath)) throw new Error(`File '${filePath}' does not exist`);
    fsSync.unlinkSync(filePath);
    return `File '${filePath}' deleted successfully`;
};

export const folderTree = async (dirPath: string, indent: string = ''): Promise<string> => {
    let items;
    try {
        items = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
        throw new Error(`Directory '${dirPath}' does not exist`);
    }

    let result = `${indent}${path.basename(dirPath)}/\n`;

    const subTasks = items.map(async (item) => {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            return await folderTree(fullPath, indent + '    ');
        } else {
            return `${indent}    ${item.name}\n`;
        }
    });

    const subResults = await Promise.all(subTasks);
    result += subResults.join('');
    return result;
};

/** --- System/Automation Tools --- **/

export const getType = (a: any): string => typeof a;

// In Node.js, keyboard input is handled via readline
export const keyboardInput = async (prompt: string): Promise<string> => {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        readline.question(prompt, (answer: string) => {
            readline.close();
            resolve(answer);
        });
    });
};

export const mouseMove = (x: number, y: number): string => {
    robot.moveMouse(x, y);
    return `Mouse moved to (${x}, {y})`;
};

export const click = (): string => {
    robot.mouseClick();
    return "Mouse clicked";
};

export const mouseDrag = (endX: number, endY: number): string => {
    // Note: RobotJS drag logic differs slightly from Python's mouse lib
    robot.dragMouse(endX, endY);
    return `Mouse dragged to (${endX}, ${endY})`;
};

export const keyboardWrite = (text: string): string => {
    robot.typeString(text);
    return `Text '${text}' typed`;
};

export const keyboardPress = (key: string): string => {
    robot.keyToggle(key, "down");
    return `Key '${key}' pressed`;
};

export const keyboardRelease = (key: string): string => {
    robot.keyToggle(key, "up");
    return `Key '${key}' released`;
};

export const openApplication = (appName: string): string => {
    // Windows specific 'Start' key logic
    robot.keyTap("command"); // 'command' acts as Windows key in many JS libs
    robot.typeString(appName);
    robot.keyTap("enter");
    return `Application '${appName}' opened`;
};

/** --- Tool Registration Logic --- **/

type ToolFunc = (...args: any[]) => any;

const createTool = (name: string, description: string, func: ToolFunc): void => {
    // mcp.create_tool(name, description, func)
    console.log(`Tool registered: ${name}`);
};

export const createTools = (): void => {
    createTool("add", "Add two numbers", add);
    createTool("mkdirs", "Create a directory", mkdirs);
    createTool("folderTree", "Return string representation of folder structure", folderTree);
    // ... repeat for other functions
};

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: unknown;
};

