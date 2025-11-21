export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type LogContext =
  | 'drag-drop'
  | 'bookmark'
  | 'folder'
  | 'storage'
  | 'service-worker'
  | 'ui'
  | 'general';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
  context?: LogContext;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}