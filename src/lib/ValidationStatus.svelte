<script lang="ts">
  import type { ValidationResult } from './validation';
  
  export let result: ValidationResult | null = null;
  export let compact = false;
  export let showWarnings = true;
  
  $: hasErrors = result && result.errors.length > 0;
  $: hasWarnings = result && result.warnings.length > 0;
  $: isValid = result && result.isValid;
</script>

{#if result && (hasErrors || (hasWarnings && showWarnings))}
  <div 
    class="validation-status" 
    class:compact
    class:error={hasErrors}
    class:warning={hasWarnings && !hasErrors}
  >
    <!-- Status icon -->
    <div class="status-icon">
      {#if hasErrors}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      {:else if hasWarnings}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      {/if}
    </div>
    
    <!-- Status messages -->
    {#if !compact}
      <div class="status-messages">
        {#if hasErrors}
          {#each result.errors as error}
            <div class="status-message error-message">{error}</div>
          {/each}
        {/if}
        
        {#if hasWarnings && showWarnings && !hasErrors}
          {#each result.warnings as warning}
            <div class="status-message warning-message">{warning}</div>
          {/each}
        {/if}
      </div>
    {:else}
      <!-- Compact mode: show count -->
      <span class="status-count">
        {#if hasErrors}
          {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
        {:else if hasWarnings}
          {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
        {/if}
      </span>
    {/if}
  </div>
{:else if result && isValid}
  <!-- Valid state indicator -->
  <div class="validation-status valid" class:compact>
    <div class="status-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    </div>
    {#if !compact}
      <span class="status-text">Valid</span>
    {/if}
  </div>
{/if}

<style>
  .validation-status {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }
  
  .validation-status.compact {
    padding: 0.25rem;
    gap: 0.25rem;
    align-items: center;
  }
  
  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  
  .validation-status.compact .status-icon {
    width: 12px;
    height: 12px;
    margin-top: 0;
  }
  
  .status-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .status-messages {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
  }
  
  .status-message {
    line-height: 1.3;
  }
  
  .status-count,
  .status-text {
    font-weight: 500;
    white-space: nowrap;
  }
  
  /* Error state */
  .validation-status.error {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.2);
  }
  
  .error-message {
    color: #dc2626;
  }
  
  /* Warning state */
  .validation-status.warning {
    color: #d97706;
    background: rgba(217, 119, 6, 0.1);
    border-color: rgba(217, 119, 6, 0.2);
  }
  
  .warning-message {
    color: #d97706;
  }
  
  /* Valid state */
  .validation-status.valid {
    color: #059669;
    background: rgba(5, 150, 105, 0.1);
    border-color: rgba(5, 150, 105, 0.2);
  }
  
  .status-text {
    color: #059669;
  }
  
  @media (max-width: 768px) {
    .validation-status {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
    }
    
    .validation-status.compact {
      padding: 0.2rem;
    }
    
    .status-icon {
      width: 12px;
      height: 12px;
    }
    
    .validation-status.compact .status-icon {
      width: 10px;
      height: 10px;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .validation-status.error {
      background: rgba(220, 38, 38, 0.15);
      border-color: rgba(220, 38, 38, 0.3);
    }
    
    .validation-status.warning {
      background: rgba(217, 119, 6, 0.15);
      border-color: rgba(217, 119, 6, 0.3);
    }
    
    .validation-status.valid {
      background: rgba(5, 150, 105, 0.15);
      border-color: rgba(5, 150, 105, 0.3);
    }
  }
</style>
