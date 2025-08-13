<script lang="ts">
  import { onDestroy } from 'svelte';
  import { AutoSaveManager, getAutoSaveStatusData, type AutoSaveState } from './autosave';
  
  export let autoSaveManager: AutoSaveManager;
  export let compact = false;
  
  let statusData = getAutoSaveStatusData(autoSaveManager.getState());
  
  // Listen for state changes
  function handleStateChange(state: AutoSaveState) {
    statusData = getAutoSaveStatusData(state);
  }
  
  autoSaveManager.addListener(handleStateChange);
  
  // Cleanup on destroy
  onDestroy(() => {
    autoSaveManager.removeListener(handleStateChange);
  });
  
  // Force save on click
  function handleClick() {
    if (statusData.state.isDirty && !statusData.state.isSaving) {
      autoSaveManager.forceSave();
    }
  }
</script>

<div 
  class="autosave-status" 
  class:compact
  class:clickable={statusData.state.isDirty && !statusData.state.isSaving}
  class:saving={statusData.statusClass === 'saving'}
  class:error={statusData.statusClass === 'error'}
  class:dirty={statusData.statusClass === 'dirty'}
  class:saved={statusData.statusClass === 'saved'}
  on:click={handleClick}
  title={statusData.state.isDirty && !statusData.state.isSaving ? 'Click to save now' : statusData.statusText}
>
  <!-- Status icon -->
  <div class="status-icon">
    {#if statusData.statusClass === 'saving'}
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
    {:else if statusData.statusClass === 'error'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    {:else if statusData.statusClass === 'dirty'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    {:else if statusData.statusClass === 'saved'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    {/if}
  </div>
  
  <!-- Status text (hidden in compact mode) -->
  {#if !compact}
    <span class="status-text">{statusData.statusText}</span>
  {/if}
</div>

<style>
  .autosave-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .autosave-status.compact {
    padding: 0.25rem;
    gap: 0;
  }
  
  .autosave-status.clickable {
    cursor: pointer;
  }
  
  .autosave-status.clickable:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  
  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  
  .status-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .status-text {
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
  }
  
  /* Status-specific colors */
  .autosave-status.saving {
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.1);
  }
  
  .autosave-status.error {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }
  
  .autosave-status.dirty {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
  }
  
  .autosave-status.saved {
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.1);
  }
  
  .autosave-status.not-saved {
    color: #6b7280;
    border-color: rgba(107, 114, 128, 0.3);
    background: rgba(107, 114, 128, 0.1);
  }
  
  @media (max-width: 768px) {
    .autosave-status {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
    }
    
    .autosave-status.compact {
      padding: 0.2rem;
    }
    
    .status-icon {
      width: 12px;
      height: 12px;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .autosave-status {
      background: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.1);
    }
    
    .autosave-status.clickable:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .status-text {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .autosave-status.saving {
      background: rgba(59, 130, 246, 0.15);
    }
    
    .autosave-status.error {
      background: rgba(239, 68, 68, 0.15);
    }
    
    .autosave-status.dirty {
      background: rgba(245, 158, 11, 0.15);
    }
    
    .autosave-status.saved {
      background: rgba(16, 185, 129, 0.15);
    }
    
    .autosave-status.not-saved {
      background: rgba(107, 114, 128, 0.15);
    }
  }
</style>
