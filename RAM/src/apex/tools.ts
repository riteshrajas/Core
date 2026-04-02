import fs from "node:fs/promises";
import path from "node:path";

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

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: unknown;
};

