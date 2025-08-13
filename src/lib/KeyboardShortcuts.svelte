<script lang="ts">
  import { editMode } from './stores';
  
  let showHelp = false;
  
  // Toggle help visibility
  function toggleHelp() {
    showHelp = !showHelp;
  }
  
  // Handle keyboard shortcut to show help
  function handleKeydown(event: KeyboardEvent) {
    // ? key to show help
    if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      toggleHelp();
    }
    
    // Escape to close help
    if (event.key === 'Escape' && showHelp) {
      event.preventDefault();
      showHelp = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showHelp}
  <div class="shortcuts-overlay" on:click={toggleHelp}>
    <div class="shortcuts-panel" on:click|stopPropagation>
      <div class="shortcuts-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="close-button" on:click={toggleHelp}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="shortcuts-content">
        <div class="shortcut-section">
          <h4>General</h4>
          <div class="shortcut-item">
            <kbd>Ctrl/Cmd + F</kbd>
            <span>Focus search</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl/Cmd + R</kbd>
            <span>Refresh bookmarks</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl/Cmd + D</kbd>
            <span>Show Brave debug info</span>
          </div>
          <div class="shortcut-item">
            <kbd>?</kbd>
            <span>Show this help</span>
          </div>
        </div>
        
        <div class="shortcut-section">
          <h4>Edit Mode</h4>
          <div class="shortcut-item">
            <kbd>Ctrl/Cmd + E</kbd>
            <span>Toggle edit mode</span>
          </div>
          {#if $editMode}
            <div class="shortcut-item">
              <kbd>Ctrl/Cmd + S</kbd>
              <span>Save all changes</span>
            </div>
            <div class="shortcut-item">
              <kbd>Escape</kbd>
              <span>Exit edit mode</span>
            </div>
            <div class="shortcut-item">
              <kbd>Double-click</kbd>
              <span>Edit bookmark/folder</span>
            </div>
            <div class="shortcut-item">
              <kbd>Enter</kbd>
              <span>Save changes</span>
            </div>
            <div class="shortcut-item">
              <kbd>Escape</kbd>
              <span>Cancel editing</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .shortcuts-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }
  
  .shortcuts-panel {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 400px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }
  
  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  
  .shortcuts-header h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #374151;
  }
  
  .close-button svg {
    width: 16px;
    height: 16px;
  }
  
  .shortcuts-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .shortcut-section h4 {
    margin: 0 0 0.75rem 0;
    color: #374151;
    font-size: 1rem;
    font-weight: 600;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    padding-bottom: 0.5rem;
  }
  
  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  .shortcut-item:last-child {
    border-bottom: none;
  }
  
  kbd {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 0.75rem;
    color: #374151;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .shortcut-item span {
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  @media (max-width: 768px) {
    .shortcuts-panel {
      padding: 1rem;
      max-width: 350px;
    }
    
    .shortcuts-header h3 {
      font-size: 1.125rem;
    }
    
    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
    
    kbd {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .shortcuts-panel {
      background: rgba(30, 30, 30, 0.95);
      border-color: rgba(255, 255, 255, 0.1);
    }
    
    .shortcuts-header h3 {
      color: #f9fafb;
    }
    
    .shortcut-section h4 {
      color: #e5e7eb;
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    
    .shortcut-item {
      border-bottom-color: rgba(255, 255, 255, 0.05);
    }
    
    .shortcut-item span {
      color: #9ca3af;
    }
    
    kbd {
      background: #374151;
      border-color: #4b5563;
      color: #e5e7eb;
    }
    
    .close-button {
      color: #9ca3af;
    }
    
    .close-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #e5e7eb;
    }
  }
</style>
