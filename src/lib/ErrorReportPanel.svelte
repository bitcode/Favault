<script lang="ts">
  import { onMount } from 'svelte';
  import { errorReporter, type ErrorReport, type ErrorReportSummary } from './error-reporter';
  import { extensionDiagnostics, runDiagnosticsAndGetReport } from './extension-diagnostics';

  export let visible = false;

  let summary: ErrorReportSummary | null = null;
  let errors: ErrorReport[] = [];
  let diagnosticsReport = '';
  let isRunningDiagnostics = false;
  let selectedTab: 'summary' | 'errors' | 'diagnostics' = 'summary';
  let selectedError: ErrorReport | null = null;
  let copySuccess = false;
  let exportSuccess = false;

  onMount(() => {
    refreshData();
  });

  function refreshData() {
    summary = errorReporter.generateSummary();
    errors = errorReporter.getErrors();
  }

  async function runDiagnostics() {
    isRunningDiagnostics = true;
    try {
      diagnosticsReport = await runDiagnosticsAndGetReport();
    } catch (error) {
      diagnosticsReport = `Error running diagnostics: ${(error as Error).message}`;
    } finally {
      isRunningDiagnostics = false;
    }
  }

  async function copyReport() {
    try {
      const success = await errorReporter.copyToClipboard('text');
      if (success) {
        copySuccess = true;
        setTimeout(() => copySuccess = false, 2000);
      }
    } catch (error) {
      console.error('Failed to copy report:', error);
    }
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnosticsReport);
      copySuccess = true;
      setTimeout(() => copySuccess = false, 2000);
    } catch (error) {
      console.error('Failed to copy diagnostics:', error);
    }
  }

  function downloadReport() {
    try {
      errorReporter.downloadReport('text');
      exportSuccess = true;
      setTimeout(() => exportSuccess = false, 2000);
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  }

  function clearErrors() {
    errorReporter.clearErrors();
    refreshData();
  }

  function selectError(error: ErrorReport) {
    selectedError = error;
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#eab308';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  function close(event?: Event) {
    if (event && event.target !== event.currentTarget) {
      return;
    }
    visible = false;
    selectedError = null;
  }
</script>

{#if visible}
  <button class="error-report-overlay" on:click={close} on:keydown|self={(e) => e.key === 'Escape' && close()}>
    <div class="error-report-panel" role="document">
      <div class="panel-header">
        <h2>🚨 FaVault Error Report</h2>
        <button class="close-button" on:click={close}>×</button>
      </div>

      <div class="panel-tabs">
        <button 
          class="tab-button" 
          class:active={selectedTab === 'summary'}
          on:click={() => selectedTab = 'summary'}
        >
          Summary
        </button>
        <button 
          class="tab-button" 
          class:active={selectedTab === 'errors'}
          on:click={() => selectedTab = 'errors'}
        >
          Errors ({errors.length})
        </button>
        <button 
          class="tab-button" 
          class:active={selectedTab === 'diagnostics'}
          on:click={() => selectedTab = 'diagnostics'}
        >
          Diagnostics
        </button>
      </div>

      <div class="panel-content">
        {#if selectedTab === 'summary' && summary}
          <div class="summary-section">
            <div class="summary-stats">
              <div class="stat-card">
                <div class="stat-number">{summary.totalErrors}</div>
                <div class="stat-label">Total Errors</div>
              </div>
              <div class="stat-card critical">
                <div class="stat-number">{summary.criticalErrors}</div>
                <div class="stat-label">Critical</div>
              </div>
              <div class="stat-card recent">
                <div class="stat-number">{summary.recentErrors}</div>
                <div class="stat-label">Recent (5min)</div>
              </div>
              <div class="stat-card" style="background-color: {getStatusColor(summary.systemHealth)}20; border-color: {getStatusColor(summary.systemHealth)}">
                <div class="stat-label" style="color: {getStatusColor(summary.systemHealth)}">
                  {summary.systemHealth.toUpperCase()}
                </div>
              </div>
            </div>

            {#if summary.recommendations.length > 0}
              <div class="recommendations">
                <h3>🔧 Recommendations</h3>
                <ul>
                  {#each summary.recommendations as recommendation}
                    <li>{recommendation}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if summary.commonIssues.length > 0}
              <div class="common-issues">
                <h3>📊 Common Issues</h3>
                {#each summary.commonIssues as issue}
                  <div class="issue-item">
                    <span class="issue-type">{issue.type}</span>
                    <span class="issue-count">{issue.count} occurrences</span>
                    <span class="issue-time">Last: {formatTimestamp(issue.lastOccurred)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedTab === 'errors'}
          <div class="errors-section">
            {#if errors.length === 0}
              <div class="no-errors">
                <div class="no-errors-icon">✅</div>
                <p>No errors recorded</p>
              </div>
            {:else}
              <div class="errors-list">
                {#each errors as error}
                  <div 
                    class="error-item" 
                    class:selected={selectedError?.id === error.id}
                    on:click={() => selectError(error)}
                    on:keydown={(e) => e.key === 'Enter' && selectError(error)}
                    role="button"
                    tabindex="0"
                  >
                    <div class="error-header">
                      <span class="error-severity" style="background-color: {getSeverityColor(error.severity)}">
                        {error.severity}
                      </span>
                      <span class="error-type">{error.type}</span>
                      <span class="error-time">{formatTimestamp(error.timestamp)}</span>
                    </div>
                    <div class="error-message">{error.message}</div>
                    <div class="error-category">{error.category}</div>
                  </div>
                {/each}
              </div>

              {#if selectedError}
                <div class="error-details">
                  <h3>Error Details</h3>
                  <div class="detail-item">
                    <strong>ID:</strong> {selectedError.id}
                  </div>
                  <div class="detail-item">
                    <strong>Timestamp:</strong> {formatTimestamp(selectedError.timestamp)}
                  </div>
                  <div class="detail-item">
                    <strong>Type:</strong> {selectedError.type}
                  </div>
                  <div class="detail-item">
                    <strong>Severity:</strong> {selectedError.severity}
                  </div>
                  <div class="detail-item">
                    <strong>Category:</strong> {selectedError.category}
                  </div>
                  <div class="detail-item">
                    <strong>Recoverable:</strong> {selectedError.recoverable ? 'Yes' : 'No'}
                  </div>
                  <div class="detail-item">
                    <strong>Message:</strong> {selectedError.message}
                  </div>
                  
                  {#if selectedError.suggestions.length > 0}
                    <div class="detail-item">
                      <strong>Suggestions:</strong>
                      <ul>
                        {#each selectedError.suggestions as suggestion}
                          <li>{suggestion}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  {#if selectedError.stack}
                    <div class="detail-item">
                      <strong>Stack Trace:</strong>
                      <pre class="stack-trace">{selectedError.stack}</pre>
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        {#if selectedTab === 'diagnostics'}
          <div class="diagnostics-section">
            <div class="diagnostics-controls">
              <button 
                class="run-diagnostics-button" 
                on:click={runDiagnostics}
                disabled={isRunningDiagnostics}
              >
                {isRunningDiagnostics ? '🔄 Running...' : '🔍 Run Diagnostics'}
              </button>
              
              {#if diagnosticsReport}
                <button class="copy-button" on:click={copyDiagnostics}>
                  {copySuccess ? '✅ Copied!' : '📋 Copy Report'}
                </button>
              {/if}
            </div>

            {#if diagnosticsReport}
              <div class="diagnostics-report">
                <pre>{diagnosticsReport}</pre>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="panel-footer">
        <div class="footer-actions">
          <button class="refresh-button" on:click={refreshData}>
            🔄 Refresh
          </button>
          <button class="copy-button" on:click={copyReport}>
            {copySuccess ? '✅ Copied!' : '📋 Copy Report'}
          </button>
          <button class="download-button" on:click={downloadReport}>
            {exportSuccess ? '✅ Downloaded!' : '💾 Download'}
          </button>
          <button class="clear-button" on:click={clearErrors}>
            🗑️ Clear Errors
          </button>
        </div>
      </div>
    </div>
  </button>
{/if}

<style>
  .error-report-overlay {
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
    border: none;
    padding: 0;
    font: inherit;
    text-align: inherit;
    cursor: default;
    width: 100%;
  }

  .error-report-panel {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    width: 90vw;
    max-width: 1000px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .panel-header h2 {
    margin: 0;
    color: #1f2937;
    font-size: 1.5rem;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 12px 24px;
    cursor: pointer;
    color: #6b7280;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .tab-button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
    background: white;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .stat-card.critical {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .stat-card.recent {
    background: #fffbeb;
    border-color: #fed7aa;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .recommendations, .common-issues {
    margin-bottom: 24px;
  }

  .recommendations h3, .common-issues h3 {
    margin: 0 0 12px 0;
    color: #1f2937;
    font-size: 1.125rem;
  }

  .recommendations ul {
    margin: 0;
    padding-left: 20px;
  }

  .recommendations li {
    margin-bottom: 8px;
    color: #374151;
  }

  .issue-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .issue-type {
    font-weight: 600;
    color: #1f2937;
  }

  .issue-count {
    background: #dbeafe;
    color: #1e40af;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .issue-time {
    color: #6b7280;
    font-size: 0.875rem;
    margin-left: auto;
  }

  .no-errors {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
  }

  .no-errors-icon {
    font-size: 4rem;
    margin-bottom: 16px;
  }

  .errors-list {
    margin-bottom: 24px;
  }

  .error-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-item:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .error-item.selected {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .error-severity {
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .error-type {
    background: #f3f4f6;
    color: #374151;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .error-time {
    color: #6b7280;
    font-size: 0.875rem;
    margin-left: auto;
  }

  .error-message {
    color: #1f2937;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .error-category {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .error-details {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
  }

  .error-details h3 {
    margin: 0 0 16px 0;
    color: #1f2937;
  }

  .detail-item {
    margin-bottom: 12px;
  }

  .detail-item strong {
    color: #374151;
    display: inline-block;
    min-width: 100px;
  }

  .stack-trace {
    background: #1f2937;
    color: #f9fafb;
    padding: 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    overflow-x: auto;
    margin-top: 8px;
  }

  .diagnostics-controls {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .diagnostics-report {
    background: #1f2937;
    color: #f9fafb;
    border-radius: 8px;
    overflow: hidden;
  }

  .diagnostics-report pre {
    margin: 0;
    padding: 20px;
    font-size: 0.875rem;
    line-height: 1.5;
    overflow-x: auto;
  }

  .panel-footer {
    border-top: 1px solid #e5e7eb;
    padding: 16px 20px;
    background: #f9fafb;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .refresh-button, .copy-button, .download-button, .clear-button, .run-diagnostics-button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .refresh-button:hover, .copy-button:hover, .download-button:hover, .run-diagnostics-button:hover {
    background: #1d4ed8;
  }

  .clear-button {
    background: #dc2626;
  }

  .clear-button:hover {
    background: #b91c1c;
  }

  .run-diagnostics-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .error-report-panel {
      width: 95vw;
      height: 90vh;
    }

    .summary-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .error-header {
      flex-wrap: wrap;
    }

    .footer-actions {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
