import fs from 'fs';
import path from 'path';
import os from 'os';

export enum ErrorCategory {
  NETWORK = 'network',
  PERMISSION = 'permission',
  SYNTAX = 'syntax',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  message: string;
  stack?: string;
  code?: string;
  category: ErrorCategory;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorHistoryEntry {
  context: ErrorContext;
  attemptCount: number;
  recovered: boolean;
  recoveryStrategy?: string;
  suggestion?: string;
}

export interface ErrorPattern {
  pattern: string;
  category: ErrorCategory;
  frequency: number;
  lastOccurrence: number;
  suggestion?: string;
}

export interface RecoveryStrategy {
  category: ErrorCategory;
  execute: (error: ErrorContext) => Promise<void>;
  shouldRetry: (error: ErrorContext, attemptCount: number) => boolean;
}

export interface ErrorPrediction {
  category: ErrorCategory;
  probability: number;
  confidence: number;
  reasoning: string;
}

export interface RecoverySuggestion {
  strategy: string;
  successRate: number;
  estimatedTime: number;
  steps: string[];
}

export interface AnalyticsReport {
  timestamp: number;
  totalErrors: number;
  timeWindow: string;
  topErrors: Array<{ category: ErrorCategory; count: number; percentage: number }>;
  recoverySuccessRate: number;
  trending: ErrorPattern[];
  predictions: ErrorPrediction[];
  recommendations: RecoverySuggestion[];
}

export class ErrorRecoveryManager {
  private errorHistoryPath: string;
  private errorHistory: ErrorHistoryEntry[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private recoveryStrategies: Map<ErrorCategory, RecoveryStrategy> = new Map();
  private maxRetries = 3;
  private baseDelayMs = 1000;
  private maxDelayMs = 5000;

  constructor() {
    this.errorHistoryPath = path.join(os.homedir(), '.apex', 'error-history.json');
    this.initializeErrorHistory();
    this.initializeRecoveryStrategies();
  }

  private initializeErrorHistory(): void {
    try {
      const dir = path.dirname(this.errorHistoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.errorHistoryPath)) {
        const data = fs.readFileSync(this.errorHistoryPath, 'utf-8');
        this.errorHistory = JSON.parse(data);
      }
    } catch (err) {
      this.errorHistory = [];
    }
  }

  private initializeRecoveryStrategies(): void {
    // Network errors - retry with backoff
    this.registerStrategy(ErrorCategory.NETWORK, {
      category: ErrorCategory.NETWORK,
      execute: async () => {
        // Network recovery could include cache fallback, proxy retry, etc.
      },
      shouldRetry: (_, attempt) => attempt < this.maxRetries,
    });

    // Permission errors - suggest authorization steps
    this.registerStrategy(ErrorCategory.PERMISSION, {
      category: ErrorCategory.PERMISSION,
      execute: async () => {
        // Could trigger authorization flow
      },
      shouldRetry: () => false, // Don't retry permission errors
    });

    // Timeout errors - increase timeout and retry
    this.registerStrategy(ErrorCategory.TIMEOUT, {
      category: ErrorCategory.TIMEOUT,
      execute: async () => {
        // Could implement timeout extension
      },
      shouldRetry: (_, attempt) => attempt < 2,
    });

    // Rate limit - wait and retry
    this.registerStrategy(ErrorCategory.RATE_LIMIT, {
      category: ErrorCategory.RATE_LIMIT,
      execute: async () => {
        // Wait before retrying
      },
      shouldRetry: (_, attempt) => attempt < 2,
    });

    // Authentication errors - trigger re-auth
    this.registerStrategy(ErrorCategory.AUTHENTICATION, {
      category: ErrorCategory.AUTHENTICATION,
      execute: async () => {
        // Trigger authentication refresh
      },
      shouldRetry: () => false,
    });
  }

  /**
   * Classify an error into a category
   */
  classifyError(error: Error | string, metadata?: Record<string, unknown>): ErrorCategory {
    const errorStr = typeof error === 'string' ? error : error.message || String(error);
    const stack = error instanceof Error ? error.stack : '';

    // Network errors
    if (
      errorStr.includes('ECONNREFUSED') ||
      errorStr.includes('ENOTFOUND') ||
      errorStr.includes('timeout') ||
      errorStr.includes('network')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Permission errors
    if (
      errorStr.includes('EACCES') ||
      errorStr.includes('EPERM') ||
      errorStr.includes('permission') ||
      errorStr.includes('403')
    ) {
      return ErrorCategory.PERMISSION;
    }

    // Syntax errors
    if (
      errorStr.includes('SyntaxError') ||
      errorStr.includes('parse error') ||
      errorStr.includes('unexpected token')
    ) {
      return ErrorCategory.SYNTAX;
    }

    // Timeout errors
    if (
      errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('timeout') ||
      errorStr.includes('timed out')
    ) {
      return ErrorCategory.TIMEOUT;
    }

    // Not found errors
    if (
      errorStr.includes('ENOENT') ||
      errorStr.includes('not found') ||
      errorStr.includes('404')
    ) {
      return ErrorCategory.NOT_FOUND;
    }

    // Conflict errors
    if (
      errorStr.includes('EEXIST') ||
      errorStr.includes('conflict') ||
      errorStr.includes('409')
    ) {
      return ErrorCategory.CONFLICT;
    }

    // Authentication errors
    if (
      errorStr.includes('401') ||
      errorStr.includes('unauthorized') ||
      errorStr.includes('authentication')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Rate limit errors
    if (
      errorStr.includes('429') ||
      errorStr.includes('rate limit') ||
      errorStr.includes('too many requests')
    ) {
      return ErrorCategory.RATE_LIMIT;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Register a recovery strategy for an error category
   */
  registerStrategy(category: ErrorCategory, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(category, strategy);
  }

  /**
   * Get recovery strategy for an error category
   */
  getStrategy(category: ErrorCategory): RecoveryStrategy | undefined {
    return this.recoveryStrategies.get(category);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    const delay = this.baseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a function with automatic retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: Partial<ErrorContext>,
  ): Promise<T> {
    let lastError: Error | undefined;
    let lastCategory = ErrorCategory.UNKNOWN;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        lastCategory = this.classifyError(lastError, context?.metadata);

        const strategy = this.getStrategy(lastCategory);
        const shouldRetry = strategy?.shouldRetry(
          {
            message: lastError.message,
            stack: lastError.stack,
            category: lastCategory,
            timestamp: Date.now(),
            metadata: context?.metadata,
          },
          attempt,
        ) ?? attempt < this.maxRetries;

        if (shouldRetry && attempt < this.maxRetries) {
          const delayMs = this.calculateBackoffDelay(attempt);
          await this.sleep(delayMs);
          continue;
        }

        // Log error before throwing
        this.logError(
          {
            message: lastError.message,
            stack: lastError.stack,
            code: (lastError as any).code,
            category: lastCategory,
            timestamp: Date.now(),
            metadata: context?.metadata,
          },
          attempt,
          false,
        );

        throw lastError;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('Unknown error occurred');
  }

  /**
   * Log an error to history
   */
  logError(
    context: ErrorContext,
    attemptCount: number = 1,
    recovered: boolean = false,
    recoveryStrategy?: string,
  ): void {
    const entry: ErrorHistoryEntry = {
      context,
      attemptCount,
      recovered,
      recoveryStrategy,
      suggestion: this.getSuggestion(context.category),
    };

    this.errorHistory.push(entry);

    // Track patterns
    const patternKey = this.generatePatternKey(context.message);
    const existing = this.errorPatterns.get(patternKey);

    if (existing) {
      existing.frequency++;
      existing.lastOccurrence = context.timestamp;
    } else {
      this.errorPatterns.set(patternKey, {
        pattern: context.message,
        category: context.category,
        frequency: 1,
        lastOccurrence: context.timestamp,
        suggestion: this.getSuggestion(context.category),
      });
    }

    // Persist to disk
    this.persistErrorHistory();
  }

  /**
   * Generate a pattern key from an error message
   */
  private generatePatternKey(message: string): string {
    // Normalize error message to identify patterns
    return message
      .replace(/\d+/g, '#') // Replace numbers with #
      .replace(/'/g, '"') // Normalize quotes
      .substring(0, 100); // Limit length
  }

  /**
   * Get suggestion for an error category
   */
  getSuggestion(category: ErrorCategory): string {
    const suggestions: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: 'Check your internet connection and try again.',
      [ErrorCategory.PERMISSION]:
        'You may need elevated permissions. Try running with sudo or check file/directory permissions.',
      [ErrorCategory.SYNTAX]: 'Check the syntax of your command or configuration file.',
      [ErrorCategory.TIMEOUT]: 'The operation timed out. Try again or increase the timeout.',
      [ErrorCategory.NOT_FOUND]: 'The requested resource was not found. Check the path or URL.',
      [ErrorCategory.CONFLICT]: 'A conflict occurred. The resource may already exist.',
      [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please log in again.',
      [ErrorCategory.RATE_LIMIT]:
        'Rate limit exceeded. Wait a moment before retrying the operation.',
      [ErrorCategory.UNKNOWN]: 'An unknown error occurred. Check the logs for more details.',
    };

    return suggestions[category];
  }

  /**
   * Get error history
   */
  getErrorHistory(limit?: number): ErrorHistoryEntry[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(limit?: number): ErrorPattern[] {
    const patterns = Array.from(this.errorPatterns.values()).sort(
      (a, b) => b.frequency - a.frequency,
    );

    if (limit) {
      return patterns.slice(0, limit);
    }
    return patterns;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    recoveryRate: number;
    topPatterns: ErrorPattern[];
  } {
    const byCategory: Record<ErrorCategory, number> = {} as any;
    let recovered = 0;

    for (const entry of this.errorHistory) {
      byCategory[entry.context.category] = (byCategory[entry.context.category] || 0) + 1;
      if (entry.recovered) {
        recovered++;
      }
    }

    return {
      totalErrors: this.errorHistory.length,
      byCategory,
      recoveryRate: this.errorHistory.length > 0 ? recovered / this.errorHistory.length : 0,
      topPatterns: this.getErrorPatterns(5),
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.errorPatterns.clear();
    this.persistErrorHistory();
  }

  /**
   * Persist error history to disk
   */
  private persistErrorHistory(): void {
    try {
      const dir = path.dirname(this.errorHistoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Keep only recent errors (last 1000)
      const toSave = this.errorHistory.slice(-1000);
      fs.writeFileSync(this.errorHistoryPath, JSON.stringify(toSave, null, 2));
    } catch (err) {
      // Silently fail - don't throw error while trying to log error
      console.error('Failed to persist error history:', err);
    }
  }

  /**
   * Get error history file path (for testing/debugging)
   */
  getErrorHistoryPath(): string {
    return this.errorHistoryPath;
  }
}

/**
 * Error Analytics Engine - Analyzes error patterns, trends, and provides predictions
 */
export class ErrorAnalytics {
  constructor(private recoveryManager: ErrorRecoveryManager) {}

  /**
   * Analyze recurring error patterns
   */
  analyzePatterns(): ErrorPattern[] {
    const patterns = this.recoveryManager.getErrorPatterns();
    
    return patterns
      .filter(p => p.frequency >= 2) // Only patterns with 2+ occurrences
      .sort((a, b) => b.frequency - a.frequency)
      .map(p => ({
        ...p,
        suggestion: this.generatePatternSuggestion(p),
      }));
  }

  /**
   * Get trending errors in the last N hours
   */
  getTrendingErrors(hoursWindow: number = 24): ErrorPattern[] {
    const cutoffTime = Date.now() - hoursWindow * 60 * 60 * 1000;
    const history = this.recoveryManager.getErrorHistory();

    const trendingMap = new Map<string, { count: number; category: ErrorCategory }>();

    for (const entry of history) {
      if (entry.context.timestamp >= cutoffTime) {
        const key = entry.context.category;
        const existing = trendingMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          trendingMap.set(key, { count: 1, category: entry.context.category });
        }
      }
    }

    return Array.from(trendingMap.entries())
      .map(([_, data]) => ({
        pattern: `${data.category} errors`,
        category: data.category,
        frequency: data.count,
        lastOccurrence: Date.now(),
        suggestion: this.recoveryManager.getSuggestion(data.category),
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Calculate recovery success rate
   */
  getRecoverySuccessRate(category?: ErrorCategory): number {
    const history = this.recoveryManager.getErrorHistory();

    if (history.length === 0) {
      return 0;
    }

    let filtered = history;
    if (category) {
      filtered = history.filter(e => e.context.category === category);
    }

    if (filtered.length === 0) {
      return 0;
    }

    const recovered = filtered.filter(e => e.recovered).length;
    return (recovered / filtered.length) * 100;
  }

  /**
   * Predict next likely errors based on history
   */
  getErrorPredictions(): ErrorPrediction[] {
    const patterns = this.analyzePatterns();
    const trendingErrors = this.getTrendingErrors(6); // Last 6 hours
    
    const predictions: ErrorPrediction[] = [];
    const seenCategories = new Set<string>();

    // Weight recent trending errors more heavily
    for (const trending of trendingErrors) {
      if (!seenCategories.has(trending.category)) {
        const pattern = patterns.find(p => p.category === trending.category);
        const frequency = pattern?.frequency || trending.frequency;
        const probability = Math.min((frequency / (this.recoveryManager.getErrorHistory().length || 1)) * 100, 95);
        
        predictions.push({
          category: trending.category,
          probability: probability,
          confidence: Math.min(70 + frequency, 95),
          reasoning: `High frequency in recent activity (${frequency} occurrences)`,
        });

        seenCategories.add(trending.category);
      }
    }

    // Add patterns that have strong history
    for (const pattern of patterns) {
      if (!seenCategories.has(pattern.category) && pattern.frequency >= 5) {
        const probability = Math.min((pattern.frequency / (this.recoveryManager.getErrorHistory().length || 1)) * 100, 85);
        
        predictions.push({
          category: pattern.category,
          probability: probability,
          confidence: Math.min(60 + pattern.frequency * 5, 90),
          reasoning: `Recurring pattern with ${pattern.frequency} historical occurrences`,
        });

        seenCategories.add(pattern.category);
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get ML-powered recovery recommendations based on error history
   */
  getSuggestedRecoveries(category?: ErrorCategory): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    const categoryMap: Record<ErrorCategory, RecoverySuggestion> = {
      [ErrorCategory.NETWORK]: {
        strategy: 'Network Retry with Exponential Backoff',
        successRate: this.getRecoverySuccessRate(ErrorCategory.NETWORK) || 65,
        estimatedTime: 5000,
        steps: [
          'Check internet connectivity',
          'Retry with exponential backoff (1s, 2s, 4s)',
          'Fall back to cached data if available',
        ],
      },
      [ErrorCategory.TIMEOUT]: {
        strategy: 'Increase Timeout & Reduce Load',
        successRate: this.getRecoverySuccessRate(ErrorCategory.TIMEOUT) || 55,
        estimatedTime: 10000,
        steps: [
          'Increase operation timeout by 50%',
          'Reduce concurrent operations',
          'Retry operation with new timeout',
        ],
      },
      [ErrorCategory.RATE_LIMIT]: {
        strategy: 'Throttle & Wait',
        successRate: this.getRecoverySuccessRate(ErrorCategory.RATE_LIMIT) || 90,
        estimatedTime: 3000,
        steps: ['Wait 3-5 seconds', 'Reduce request rate', 'Retry with throttling enabled'],
      },
      [ErrorCategory.PERMISSION]: {
        strategy: 'Request Authentication',
        successRate: this.getRecoverySuccessRate(ErrorCategory.PERMISSION) || 45,
        estimatedTime: 15000,
        steps: ['Prompt user for authentication', 'Refresh credentials', 'Retry operation'],
      },
      [ErrorCategory.AUTHENTICATION]: {
        strategy: 'Reauthenticate & Refresh Token',
        successRate: this.getRecoverySuccessRate(ErrorCategory.AUTHENTICATION) || 75,
        estimatedTime: 2000,
        steps: ['Clear cached tokens', 'Trigger reauthentication flow', 'Refresh auth tokens'],
      },
      [ErrorCategory.NOT_FOUND]: {
        strategy: 'Search & Fallback',
        successRate: this.getRecoverySuccessRate(ErrorCategory.NOT_FOUND) || 40,
        estimatedTime: 3000,
        steps: ['Search alternative locations', 'Check for renamed resources', 'Use fallback paths'],
      },
      [ErrorCategory.CONFLICT]: {
        strategy: 'Merge/Update & Retry',
        successRate: this.getRecoverySuccessRate(ErrorCategory.CONFLICT) || 50,
        estimatedTime: 5000,
        steps: ['Check existing resource', 'Merge or update existing', 'Retry operation'],
      },
      [ErrorCategory.SYNTAX]: {
        strategy: 'Validate & Auto-Fix',
        successRate: this.getRecoverySuccessRate(ErrorCategory.SYNTAX) || 35,
        estimatedTime: 2000,
        steps: ['Validate syntax', 'Attempt auto-correction', 'Report corrected errors'],
      },
      [ErrorCategory.UNKNOWN]: {
        strategy: 'Generic Retry',
        successRate: this.getRecoverySuccessRate(ErrorCategory.UNKNOWN) || 30,
        estimatedTime: 5000,
        steps: ['Log error details', 'Wait briefly', 'Retry operation'],
      },
    };

    if (category) {
      const suggestion = categoryMap[category];
      return suggestion ? [suggestion] : [];
    }

    return Object.values(categoryMap).sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Generate a full analytics report
   */
  generateAnalyticsReport(timeWindowHours: number = 24): AnalyticsReport {
    const history = this.recoveryManager.getErrorHistory();
    const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;

    // Filter errors within time window
    const windowErrors = history.filter(e => e.context.timestamp >= cutoffTime);

    // Calculate top errors
    const categoryCount = new Map<ErrorCategory, number>();
    for (const entry of windowErrors) {
      const count = categoryCount.get(entry.context.category) || 0;
      categoryCount.set(entry.context.category, count + 1);
    }

    const topErrors = Array.from(categoryCount.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / (windowErrors.length || 1)) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate recovery rate
    const recoveredInWindow = windowErrors.filter(e => e.recovered).length;
    const recoveryRate =
      windowErrors.length > 0 ? (recoveredInWindow / windowErrors.length) * 100 : 0;

    return {
      timestamp: Date.now(),
      totalErrors: windowErrors.length,
      timeWindow: `Last ${timeWindowHours} hours`,
      topErrors,
      recoverySuccessRate: recoveryRate,
      trending: this.getTrendingErrors(timeWindowHours),
      predictions: this.getErrorPredictions(),
      recommendations: this.getSuggestedRecoveries()
        .filter(r => r.successRate > 0)
        .slice(0, 3),
    };
  }

  /**
   * Generate a pattern-specific suggestion
   */
  private generatePatternSuggestion(pattern: ErrorPattern): string {
    const baseMap: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]:
        'Network issues detected. Implement retry logic with exponential backoff.',
      [ErrorCategory.PERMISSION]:
        'Permission-related failures. Check file/directory permissions or run with elevated privileges.',
      [ErrorCategory.SYNTAX]:
        'Syntax errors in input. Validate and auto-correct before execution.',
      [ErrorCategory.TIMEOUT]:
        'Timeout issues. Consider increasing timeout or optimizing operations.',
      [ErrorCategory.NOT_FOUND]:
        'Resource not found. Verify paths and check alternative locations.',
      [ErrorCategory.CONFLICT]:
        'Resource conflicts detected. Implement merge or update strategies.',
      [ErrorCategory.AUTHENTICATION]:
        'Authentication failures. Implement token refresh and reauthentication.',
      [ErrorCategory.RATE_LIMIT]:
        'Rate limiting occurring. Implement throttling and backoff strategies.',
      [ErrorCategory.UNKNOWN]: 'Unknown error pattern. Enable detailed logging for investigation.',
    };

    const baseSuggestion = baseMap[pattern.category];
    if (pattern.frequency >= 10) {
      return `${baseSuggestion} Frequency: ${pattern.frequency}x - HIGH PRIORITY.`;
    } else if (pattern.frequency >= 5) {
      return `${baseSuggestion} Frequency: ${pattern.frequency}x - Medium priority.`;
    }
    return baseSuggestion;
  }
}

// Export singleton instances
export const errorRecoveryManager = new ErrorRecoveryManager();
export const errorAnalytics = new ErrorAnalytics(errorRecoveryManager);
