/**
 * Utility functions for querying and analyzing logs from IndexedDB
 * 
 * Usage in browser console:
 *   const utils = await import('./lib/logging/log-query-utils.js');
 *   utils.filterByLevel('ERROR');
 *   utils.searchLogs('drag');
 */

import Logger from './index';

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  args?: any[];
  context?: string;
}

export interface LogQueryOptions {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'[];
  search?: string | RegExp;
  startTime?: Date | string;
  endTime?: Date | string;
  limit?: number;
  context?: string;
}

/**
 * Get all logs with optional filtering
 */
export async function queryLogs(options: LogQueryOptions = {}): Promise<LogEntry[]> {
  let logs = await Logger.retrieveLogs();

  // Filter by level
  if (options.level) {
    const levels = Array.isArray(options.level) ? options.level : [options.level];
    logs = logs.filter(log => levels.includes(log.level));
  }

  // Filter by search term
  if (options.search) {
    const searchRegex = typeof options.search === 'string' 
      ? new RegExp(options.search, 'i')
      : options.search;
    logs = logs.filter(log => searchRegex.test(log.message));
  }

  // Filter by time range
  if (options.startTime) {
    const startISO = typeof options.startTime === 'string' 
      ? options.startTime 
      : options.startTime.toISOString();
    logs = logs.filter(log => log.timestamp >= startISO);
  }

  if (options.endTime) {
    const endISO = typeof options.endTime === 'string'
      ? options.endTime
      : options.endTime.toISOString();
    logs = logs.filter(log => log.timestamp <= endISO);
  }

  // Filter by context
  if (options.context) {
    logs = logs.filter(log => log.context === options.context);
  }

  // Limit results
  if (options.limit) {
    logs = logs.slice(-options.limit);
  }

  return logs;
}

/**
 * Filter logs by level
 */
export async function filterByLevel(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): Promise<LogEntry[]> {
  return queryLogs({ level });
}

/**
 * Search logs by message content
 */
export async function searchLogs(searchTerm: string | RegExp): Promise<LogEntry[]> {
  return queryLogs({ search: searchTerm });
}

/**
 * Get logs from the last N minutes
 */
export async function getRecentLogs(minutes: number): Promise<LogEntry[]> {
  const startTime = new Date(Date.now() - minutes * 60 * 1000);
  return queryLogs({ startTime });
}

/**
 * Get logs from a specific time range
 */
export async function getLogsInRange(startTime: Date | string, endTime: Date | string): Promise<LogEntry[]> {
  return queryLogs({ startTime, endTime });
}

/**
 * Group logs by level and count
 */
export async function getLogStats(): Promise<Record<string, number>> {
  const logs = await Logger.retrieveLogs();
  return logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Find most common log messages
 */
export async function getTopMessages(limit: number = 10): Promise<Array<{ message: string; count: number }>> {
  const logs = await Logger.retrieveLogs();
  const messageCounts = logs.reduce((acc, log) => {
    acc[log.message] = (acc[log.message] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(messageCounts)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Display logs in a readable format
 */
export function displayLogs(logs: LogEntry[]): void {
  console.log(`\n📊 Found ${logs.length} logs:\n`);
  logs.forEach((log, i) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const emoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌'
    }[log.level] || '📝';
    
    console.log(`${i + 1}. [${time}] ${emoji} ${log.level}: ${log.message}`);
    if (log.args && log.args.length > 0) {
      console.log('   Args:', log.args);
    }
  });
  console.log('');
}

/**
 * Clear all logs (with confirmation)
 */
export async function clearLogs(confirm: boolean = false): Promise<void> {
  if (!confirm) {
    console.warn('⚠️ This will delete ALL logs. Call clearLogs(true) to confirm.');
    return;
  }

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('FavaultLogDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = db.transaction('logs', 'readwrite');
  const store = transaction.objectStore('logs');
  store.clear();

  console.log('✅ All logs cleared');
}

/**
 * Export logs to clipboard as JSON
 */
export async function copyLogsToClipboard(options: LogQueryOptions = {}): Promise<void> {
  const logs = await queryLogs(options);
  const json = JSON.stringify(logs, null, 2);
  
  await navigator.clipboard.writeText(json);
  console.log(`✅ Copied ${logs.length} logs to clipboard`);
}

