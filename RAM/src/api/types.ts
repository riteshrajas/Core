export type IngestionSource = 'cli-history' | 'project-context';

export interface CLIHistoryStreamEvent {
  type: 'cli.command_history';
  source: 'core-cli';
  project: string;
  sessionId: string;
  command: string;
  timestamp: string;
}

export interface ProjectContextDocument {
  type: 'project.context';
  source: 'project-indexer';
  projectRoot: string;
  relativePath: string;
  absolutePath: string;
  content: string;
  timestamp: string;
}

export interface IngestionFeedEvent {
  source: IngestionSource;
  recordId: string;
  text: string;
  metadata: Record<string, unknown>;
}

