<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { serviceWorkerManager, type ServiceWorkerStatus } from './service-worker-manager';

  let status: ServiceWorkerStatus = {
    isActive: false,
    lastPing: 0,
    consecutiveFailures: 0
  };
  
  let showDiagnostics = false;
  let diagnosticsHistory: Array<{timestamp: number, status: ServiceWorkerStatus}> = [];
  let maxHistoryEntries = 20;

  // Status listener
  function handleStatusChange(newStatus: ServiceWorkerStatus) {
    status = newStatus;
    
    // Add to history
    diagnosticsHistory.unshift({
      timestamp: Date.now(),
      status: { ...newStatus }
    });
    
    // Limit history size
    if (diagnosticsHistory.length > maxHistoryEntries) {
      diagnosticsHistory = diagnosticsHistory.slice(0, maxHistoryEntries);
    }
  }

  // Format timestamp
  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  // Format duration
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  }

  // Get status color
  function getStatusColor(isActive: boolean, failures: number): string {
    if (isActive && failures === 0) return '#10b981'; // green
    if (isActive && failures > 0) return '#f59e0b'; // yellow
    if (failures < 3) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  }

  // Force status check
  async function forceCheck() {
    await serviceWorkerManager.forceStatusCheck();
  }

  // Ensure active
  async function ensureActive() {
    const result = await serviceWorkerManager.ensureActive();
    console.log('Service worker ensure active result:', result);
  }

  onMount(() => {
    // Get initial status
    status = serviceWorkerManager.getStatus();
    
    // Add status listener
    serviceWorkerManager.addStatusListener(handleStatusChange);
    
    // Initial history entry
    handleStatusChange(status);
  });

  onDestroy(() => {
    serviceWorkerManager.removeStatusListener(handleStatusChange);
  });
</script>

<!-- Service Worker Status Indicator -->
<div class="service-worker-indicator" class:active={status.isActive} class:warning={status.consecutiveFailures > 0}>
  <div class="status-dot" style="background-color: {getStatusColor(status.isActive, status.consecutiveFailures)}"></div>
  <span class="status-text">
    {status.isActive ? 'SW Active' : 'SW Inactive'}
    {status.consecutiveFailures > 0 ? ` (${status.consecutiveFailures} failures)` : ''}
  </span>
  
  <button 
    class="diagnostics-toggle" 
    on:click={() => showDiagnostics = !showDiagnostics}
    title="Toggle service worker diagnostics"
  >
    📊
  </button>
</div>

<!-- Diagnostics Panel -->
{#if showDiagnostics}
  <div class="diagnostics-panel">
    <div class="diagnostics-header">
      <h3>Service Worker Diagnostics</h3>
      <button class="close-btn" on:click={() => showDiagnostics = false}>×</button>
    </div>
    
    <div class="diagnostics-content">
      <!-- Current Status -->
      <div class="status-section">
        <h4>Current Status</h4>
        <div class="status-grid">
          <div class="status-item">
            <span class="label">Active:</span>
            <span class="value" class:active={status.isActive} class:inactive={!status.isActive}>
              {status.isActive ? 'Yes' : 'No'}
            </span>
          </div>
          <div class="status-item">
            <span class="label">Last Ping:</span>
            <span class="value">
              {status.lastPing ? formatTimestamp(status.lastPing) : 'Never'}
            </span>
          </div>
          <div class="status-item">
            <span class="label">Failures:</span>
            <span class="value" class:warning={status.consecutiveFailures > 0}>
              {status.consecutiveFailures}
            </span>
          </div>
          <div class="status-item">
            <span class="label">Time Since Ping:</span>
            <span class="value">
              {status.lastPing ? formatDuration(Date.now() - status.lastPing) : 'N/A'}
            </span>
          </div>
        </div>
        
        {#if status.lastError}
          <div class="error-display">
            <strong>Last Error:</strong> {status.lastError}
          </div>
        {/if}
        
        {#if status.lifecycle}
          <div class="lifecycle-info">
            <h5>Lifecycle Info</h5>
            <pre>{JSON.stringify(status.lifecycle, null, 2)}</pre>
          </div>
        {/if}
      </div>
      
      <!-- Actions -->
      <div class="actions-section">
        <h4>Actions</h4>
        <div class="action-buttons">
          <button on:click={forceCheck} class="action-btn">Force Check</button>
          <button on:click={ensureActive} class="action-btn">Ensure Active</button>
        </div>
      </div>
      
      <!-- History -->
      <div class="history-section">
        <h4>Status History</h4>
        <div class="history-list">
          {#each diagnosticsHistory as entry}
            <div class="history-entry">
              <span class="timestamp">{formatTimestamp(entry.timestamp)}</span>
              <span class="status-indicator" style="background-color: {getStatusColor(entry.status.isActive, entry.status.consecutiveFailures)}"></span>
              <span class="status-text">
                {entry.status.isActive ? 'Active' : 'Inactive'}
                {entry.status.consecutiveFailures > 0 ? ` (${entry.status.consecutiveFailures} failures)` : ''}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .service-worker-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    padding: 8px 12px;
    border-radius: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
  }

  .service-worker-indicator:hover {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .status-text {
    color: #374151;
  }

  .diagnostics-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .diagnostics-toggle:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .diagnostics-panel {
    position: fixed;
    top: 4rem;
    right: 1rem;
    width: 400px;
    max-height: 600px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    z-index: 1001;
    overflow: hidden;
  }

  .diagnostics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .diagnostics-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .diagnostics-content {
    padding: 20px;
    max-height: 520px;
    overflow-y: auto;
  }

  .status-section, .actions-section, .history-section {
    margin-bottom: 24px;
  }

  .status-section h4, .actions-section h4, .history-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 6px;
  }

  .status-item .label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .status-item .value {
    font-size: 12px;
    font-weight: 600;
  }

  .status-item .value.active {
    color: #10b981;
  }

  .status-item .value.inactive {
    color: #ef4444;
  }

  .status-item .value.warning {
    color: #f59e0b;
  }

  .error-display {
    margin-top: 12px;
    padding: 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 12px;
    color: #dc2626;
  }

  .lifecycle-info {
    margin-top: 12px;
  }

  .lifecycle-info h5 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }

  .lifecycle-info pre {
    background: #f1f5f9;
    padding: 8px;
    border-radius: 4px;
    font-size: 10px;
    overflow-x: auto;
    margin: 0;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .action-btn:hover {
    background: #2563eb;
  }

  .history-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
  }

  .history-entry:last-child {
    border-bottom: none;
  }

  .history-entry .timestamp {
    color: #6b7280;
    font-weight: 500;
    min-width: 80px;
  }

  .history-entry .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .history-entry .status-text {
    color: #374151;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .diagnostics-panel {
      width: calc(100vw - 20px);
      right: 10px;
      left: 10px;
    }
    
    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
