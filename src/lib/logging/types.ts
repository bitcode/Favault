export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
}

export interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}