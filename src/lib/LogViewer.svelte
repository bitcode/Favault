<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Logger from './logging/index';
  import DragDropLogger from './logging/drag-drop-logger';
  import type { LogEntry, LogLevel, LogContext } from './logging/types';

  export let visible = false;
  export let autoRefresh = true;
  export let refreshInterval = 2000; // 2 seconds

  let logs: LogEntry[] = [];
  let filteredLogs: LogEntry[] = [];
  let selectedLevel: LogLevel | 'ALL' = 'ALL';
  let selectedContext: LogContext | 'ALL' = 'ALL';
  let searchTerm = '';
  let autoScroll = true;
  let refreshTimer: number | null = null;
  let logContainer: HTMLElement;

  // Stats
  let stats = {
    total: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  onMount(async () => {
    await loadLogs();
    if (autoRefresh) {
      startAutoRefresh();
    }
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  async function loadLogs() {
    logs = await Logger.retrieveLogs();
    applyFilters();
    updateStats();
    if (autoScroll && logContainer) {
      setTimeout(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      }, 100);
    }
  }

  function applyFilters() {
    filteredLogs = logs.filter(log => {
      // Level filter
      if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
        return false;
      }
      
      // Context filter
      if (selectedContext !== 'ALL' && log.context !== selectedContext) {
        return false;
      }
      
      // Search filter
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }

  function updateStats() {
    stats.total = logs.length;
    stats.debug = logs.filter(l => l.level === 'DEBUG').length;
    stats.info = logs.filter(l => l.level === 'INFO').length;
    stats.warn = logs.filter(l => l.level === 'WARN').length;
    stats.error = logs.filter(l => l.level === 'ERROR').length;
  }

  function startAutoRefresh() {
    refreshTimer = window.setInterval(loadLogs, refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  async function exportLogs() {
    await Logger.downloadLogs();
  }

  async function exportDragDropLogs() {
    await DragDropLogger.exportDragDropLogs();
  }

  async function clearAllLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('FavaultLogDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction('logs', 'readwrite');
      const store = transaction.objectStore('logs');
      store.clear();
      await loadLogs();
    }
  }

  function getLevelEmoji(level: LogLevel): string {
    const emojis = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌'
    };
    return emojis[level] || '📝';
  }

  function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  function formatArgs(args: any[]): string {
    if (!args || args.length === 0) return '';
    return args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
    ).join(', ');
  }

  $: {
    selectedLevel;
    selectedContext;
    searchTerm;
    applyFilters();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="log-viewer-overlay" on:click={() => visible = false} role="button" tabindex="-1">
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="log-viewer" on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="log-viewer-header">
        <h2>📝 Console Log Viewer</h2>
        <button class="close-btn" on:click={() => visible = false}>✕</button>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <span>Total: {stats.total}</span>
        <span class="stat-debug">🔍 {stats.debug}</span>
        <span class="stat-info">ℹ️ {stats.info}</span>
        <span class="stat-warn">⚠️ {stats.warn}</span>
        <span class="stat-error">❌ {stats.error}</span>
      </div>

      <!-- Controls -->
      <div class="controls">
        <div class="filter-group">
          <label>
            Level:
            <select bind:value={selectedLevel}>
              <option value="ALL">All</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
            </select>
          </label>

          <label>
            Context:
            <select bind:value={selectedContext}>
              <option value="ALL">All</option>
              <option value="drag-drop">Drag & Drop</option>
              <option value="bookmark">Bookmark</option>
              <option value="folder">Folder</option>
              <option value="storage">Storage</option>
              <option value="service-worker">Service Worker</option>
              <option value="ui">UI</option>
              <option value="general">General</option>
            </select>
          </label>

          <label>
            Search:
            <input type="text" bind:value={searchTerm} placeholder="Filter logs..." />
          </label>
        </div>

        <div class="action-group">
          <button on:click={loadLogs}>🔄 Refresh</button>
          <button on:click={toggleAutoRefresh} class:active={autoRefresh}>
            {autoRefresh ? '⏸️ Pause' : '▶️ Auto'}
          </button>
          <button on:click={exportLogs}>💾 Export All</button>
          <button on:click={exportDragDropLogs}>🎯 Export D&D</button>
          <button on:click={clearAllLogs} class="danger">🗑️ Clear</button>
        </div>
      </div>

      <!-- Log Display -->
      <div class="log-container" bind:this={logContainer}>
        {#if filteredLogs.length === 0}
          <div class="no-logs">
            {logs.length === 0 ? 'No logs captured yet' : 'No logs match the current filters'}
          </div>
        {:else}
          {#each filteredLogs as log}
            <div class="log-entry log-{log.level.toLowerCase()}">
              <div class="log-header">
                <span class="log-time">{formatTime(log.timestamp)}</span>
                <span class="log-level">{getLevelEmoji(log.level)} {log.level}</span>
                {#if log.context}
                  <span class="log-context">{log.context}</span>
                {/if}
              </div>
              <div class="log-message">{log.message}</div>
              {#if log.metadata}
                <details class="log-metadata">
                  <summary>Metadata</summary>
                  <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                </details>
              {/if}
              {#if log.args && log.args.length > 0}
                <details class="log-args">
                  <summary>Arguments ({log.args.length})</summary>
                  <pre>{formatArgs(log.args)}</pre>
                </details>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="log-viewer-footer">
        <label>
          <input type="checkbox" bind:checked={autoScroll} />
          Auto-scroll to bottom
        </label>
        <span>Showing {filteredLogs.length} of {logs.length} logs</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .log-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .log-viewer {
    background: #1e1e1e;
    color: #d4d4d4;
    border-radius: 8px;
    width: 90%;
    max-width: 1200px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  .log-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
    background: #252526;
  }

  .log-viewer-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #d4d4d4;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #3e3e42;
  }

  .stats-bar {
    display: flex;
    gap: 16px;
    padding: 12px 20px;
    background: #2d2d30;
    border-bottom: 1px solid #333;
    font-size: 13px;
  }

  .stats-bar span {
    padding: 4px 8px;
    border-radius: 4px;
    background: #3e3e42;
  }

  .stat-error { color: #f48771; }
  .stat-warn { color: #dcdcaa; }
  .stat-info { color: #4fc1ff; }
  .stat-debug { color: #b5cea8; }

  .controls {
    padding: 16px 20px;
    border-bottom: 1px solid #333;
    background: #252526;
  }

  .filter-group {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .filter-group label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #999;
  }

  .filter-group select,
  .filter-group input {
    background: #3c3c3c;
    border: 1px solid #555;
    color: #d4d4d4;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
  }

  .filter-group input {
    min-width: 200px;
  }

  .action-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action-group button {
    background: #0e639c;
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }

  .action-group button:hover {
    background: #1177bb;
  }

  .action-group button.active {
    background: #16825d;
  }

  .action-group button.danger {
    background: #a1260d;
  }

  .action-group button.danger:hover {
    background: #c72e0d;
  }

  .log-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
    background: #1e1e1e;
  }

  .no-logs {
    text-align: center;
    padding: 40px;
    color: #666;
    font-style: italic;
  }

  .log-entry {
    margin-bottom: 12px;
    padding: 12px;
    border-left: 3px solid #555;
    background: #252526;
    border-radius: 4px;
    font-size: 13px;
  }

  .log-entry.log-debug { border-left-color: #b5cea8; }
  .log-entry.log-info { border-left-color: #4fc1ff; }
  .log-entry.log-warn { border-left-color: #dcdcaa; }
  .log-entry.log-error { border-left-color: #f48771; }

  .log-header {
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .log-time {
    color: #858585;
  }

  .log-level {
    font-weight: 600;
  }

  .log-context {
    background: #3e3e42;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    color: #9cdcfe;
  }

  .log-message {
    color: #d4d4d4;
    margin-bottom: 8px;
    word-break: break-word;
  }

  .log-metadata,
  .log-args {
    margin-top: 8px;
    font-size: 12px;
  }

  .log-metadata summary,
  .log-args summary {
    cursor: pointer;
    color: #9cdcfe;
    user-select: none;
  }

  .log-metadata summary:hover,
  .log-args summary:hover {
    text-decoration: underline;
  }

  .log-metadata pre,
  .log-args pre {
    margin: 8px 0 0 0;
    padding: 8px;
    background: #1e1e1e;
    border-radius: 4px;
    overflow-x: auto;
    color: #ce9178;
  }

  .log-viewer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-top: 1px solid #333;
    background: #252526;
    font-size: 12px;
    color: #999;
  }

  .log-viewer-footer label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  /* Scrollbar styling */
  .log-container::-webkit-scrollbar {
    width: 12px;
  }

  .log-container::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  .log-container::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 6px;
  }

  .log-container::-webkit-scrollbar-thumb:hover {
    background: #4e4e4e;
  }
</style>

