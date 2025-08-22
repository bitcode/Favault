<script lang="ts">
  import { onMount } from 'svelte';
  import { errorReporter } from './error-reporter';
  import ErrorReportPanel from './ErrorReportPanel.svelte';

  let showPanel = false;
  let errorCount = 0;
  let hasRecentErrors = false;
  let hasCriticalErrors = false;

  onMount(() => {
    updateErrorStatus();
    
    // Update error status every 30 seconds
    const interval = setInterval(updateErrorStatus, 30000);
    
    return () => clearInterval(interval);
  });

  function updateErrorStatus() {
    const summary = errorReporter.generateSummary();
    errorCount = summary.totalErrors;
    hasRecentErrors = summary.recentErrors > 0;
    hasCriticalErrors = summary.criticalErrors > 0;
  }

  function togglePanel() {
    showPanel = !showPanel;
    if (showPanel) {
      updateErrorStatus();
    }
  }

  function getButtonClass(): string {
    if (hasCriticalErrors) return 'error-button critical';
    if (hasRecentErrors) return 'error-button warning';
    if (errorCount > 0) return 'error-button info';
    return 'error-button normal';
  }

  function getButtonIcon(): string {
    if (hasCriticalErrors) return '🚨';
    if (hasRecentErrors) return '⚠️';
    if (errorCount > 0) return 'ℹ️';
    return '✅';
  }

  function getButtonTitle(): string {
    if (hasCriticalErrors) return `${errorCount} errors (${hasCriticalErrors} critical)`;
    if (hasRecentErrors) return `${errorCount} errors (recent activity)`;
    if (errorCount > 0) return `${errorCount} errors recorded`;
    return 'No errors - system healthy';
  }
</script>

<button 
  class={getButtonClass()}
  title={getButtonTitle()}
  on:click={togglePanel}
>
  <span class="error-icon">{getButtonIcon()}</span>
  {#if errorCount > 0}
    <span class="error-count">{errorCount}</span>
  {/if}
  <span class="error-label">Errors</span>
</button>

<ErrorReportPanel bind:visible={showPanel} />

<style>
  .error-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.2s;
    position: relative;
    min-width: 80px;
  }

  .error-button.normal {
    background: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }

  .error-button.normal:hover {
    background: #e0f2fe;
    border-color: #7dd3fc;
  }

  .error-button.info {
    background: #fffbeb;
    color: #d97706;
    border: 1px solid #fed7aa;
  }

  .error-button.info:hover {
    background: #fef3c7;
    border-color: #fbbf24;
  }

  .error-button.warning {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    animation: pulse-warning 2s infinite;
  }

  .error-button.warning:hover {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  .error-button.critical {
    background: #7f1d1d;
    color: white;
    border: 1px solid #991b1b;
    animation: pulse-critical 1s infinite;
  }

  .error-button.critical:hover {
    background: #991b1b;
    border-color: #b91c1c;
  }

  .error-icon {
    font-size: 1rem;
  }

  .error-count {
    background: rgba(255, 255, 255, 0.9);
    color: inherit;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
  }

  .error-button.critical .error-count {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .error-label {
    font-weight: 500;
  }

  @keyframes pulse-warning {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.1);
    }
  }

  @keyframes pulse-critical {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.2);
    }
  }

  @media (max-width: 768px) {
    .error-button {
      padding: 6px 10px;
      font-size: 0.8rem;
      min-width: 60px;
    }

    .error-label {
      display: none;
    }
  }
</style>
