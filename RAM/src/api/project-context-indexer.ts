import { createHash } from 'node:crypto';
import { existsSync, watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MemoryIngestionPipeline } from './ingestion-pipeline';
import type { ProjectContextDocument } from './types';

export const DEFAULT_PROJECT_CONTEXT_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'ANALYZE_FEATURES_README.md',
  'AGENT.md',
  'AGENTS.md',
  'ROADMAP.md',
  'Core/README.md',
  'Core/CLI/README.md',
  'Core/RAM/README.md',
  'MicroMax/README.md',
  'MicroMax/OS/README.md',
  'IOT/README.md',
];

export interface ProjectContextIndexerOptions {
  projectRoot: string;
  pipeline: MemoryIngestionPipeline;
  keyFiles?: string[];
  debounceMs?: number;
}

export class ProjectContextIndexer {
  private readonly projectRoot: string;
  private readonly pipeline: MemoryIngestionPipeline;
  private readonly keyFiles: string[];
  private readonly debounceMs: number;
  private readonly watchers: FSWatcher[] = [];
  private readonly digestByRelativePath = new Map<string, string>();
  private readonly pendingTimers = new Map<string, NodeJS.Timeout>();

  constructor(options: ProjectContextIndexerOptions) {
    this.projectRoot = options.projectRoot;
    this.pipeline = options.pipeline;
    this.keyFiles = [
      ...new Set((options.keyFiles ?? DEFAULT_PROJECT_CONTEXT_FILES).map(normalizeRelativePath)),
    ];
    this.debounceMs = options.debounceMs ?? 200;
  }

  async start(): Promise<void> {
    await this.indexNow();
    this.startWatchers();
  }

  async stop(): Promise<void> {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.length = 0;

    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }

  async indexNow(): Promise<void> {
    for (const relativePath of this.keyFiles) {
      await this.indexFile(relativePath);
    }
  }

  private startWatchers(): void {
    const keyFileSet = new Set(this.keyFiles);
    const directories = [...new Set(this.keyFiles.map((relativePath) => path.dirname(relativePath)))];
    for (const relativeDirectory of directories) {
      const absoluteDirectory = path.resolve(this.projectRoot, relativeDirectory);
      if (!existsSync(absoluteDirectory)) {
        continue;
      }

      const watcher = watch(absoluteDirectory, (_eventType, fileName) => {
        if (!fileName) {
          return;
        }
        const relativePath = normalizeRelativePath(path.join(relativeDirectory, fileName.toString()));
        if (!keyFileSet.has(relativePath)) {
          return;
        }
        this.scheduleIndex(relativePath);
      });
      this.watchers.push(watcher);
    }
  }

  private scheduleIndex(relativePath: string): void {
    const existingTimer = this.pendingTimers.get(relativePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(relativePath);
      void this.indexFile(relativePath);
    }, this.debounceMs);
    this.pendingTimers.set(relativePath, timer);
  }

  private async indexFile(relativePath: string): Promise<void> {
    const absolutePath = path.resolve(this.projectRoot, relativePath);
    if (!existsSync(absolutePath)) {
      return;
    }

    let content = '';
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch {
      return;
    }

    const digest = createHash('sha256').update(content).digest('hex');
    if (this.digestByRelativePath.get(relativePath) === digest) {
      return;
    }
    this.digestByRelativePath.set(relativePath, digest);

    const payload: ProjectContextDocument = {
      type: 'project.context',
      source: 'project-indexer',
      projectRoot: this.projectRoot,
      relativePath,
      absolutePath,
      content,
      timestamp: new Date().toISOString(),
    };
    await this.pipeline.ingestProjectContext(payload);
  }
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

