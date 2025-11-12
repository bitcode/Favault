import type { LoggerConfig, LogLevel } from './types';

const defaultConfig: LoggerConfig = {
  level: 'INFO',
  enabled: true,
};

let currentConfig: LoggerConfig = { ...defaultConfig };

export function configure(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function setLogLevel(level: LogLevel): void {
  currentConfig.level = level;
}

export function isEnabled(): boolean {
  return currentConfig.enabled;
}

export function getLogLevel(): LogLevel {
  return currentConfig.level;
}