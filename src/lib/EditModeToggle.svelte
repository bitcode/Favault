<script lang="ts">
  import { editMode, settingsVisible, settingsManager } from './stores';
  
  // Toggle edit mode
  async function toggleEditMode() {
    const newEditMode = !$editMode;
    await settingsManager.updateEditMode({ enabled: newEditMode });
  }
  
  // Open settings panel
  function openSettings() {
    settingsVisible.set(true);
  }
</script>

<div class="edit-mode-controls">
  <button 
    class="edit-toggle" 
    class:active={$editMode}
    on:click={toggleEditMode}
    title={$editMode ? 'Exit edit mode (Ctrl+E)' : 'Enter edit mode (Ctrl+E)'}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    <span>{$editMode ? 'Exit Edit' : 'Edit'}</span>
  </button>
  
  <button 
    class="settings-button"
    on:click={openSettings}
    title="Open settings"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="m12 1 1.68 3.36L17 6.64l-1.68 3.36L12 11.68 8.32 10 5 6.64l3.32-1.68L12 1z"></path>
      <path d="m12 12.32 3.68 1.68L19 17.36l-3.68 1.68L12 22.32 8.32 19 5 17.36l3.32-1.68L12 12.32z"></path>
    </svg>
  </button>
</div>

<style>
  .edit-mode-controls {
    position: fixed;
    top: 2rem;
    right: 2rem;
    display: flex;
    gap: 0.5rem;
    z-index: 100;
  }
  
  .edit-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .edit-toggle:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }
  
  .edit-toggle.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }
  
  .edit-toggle.active:hover {
    background: #5a6fd8;
  }
  
  .edit-toggle svg {
    width: 18px;
    height: 18px;
  }
  
  .settings-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    cursor: pointer;
    color: #333;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .settings-button:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }
  
  .settings-button svg {
    width: 18px;
    height: 18px;
  }
  
  @media (max-width: 768px) {
    .edit-mode-controls {
      top: 1rem;
      right: 1rem;
    }
    
    .edit-toggle {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }
    
    .edit-toggle span {
      display: none;
    }
    
    .settings-button {
      padding: 0.5rem;
    }
    
    .edit-toggle svg,
    .settings-button svg {
      width: 16px;
      height: 16px;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .edit-toggle,
    .settings-button {
      background: rgba(40, 40, 40, 0.9);
      border-color: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    
    .edit-toggle:hover,
    .settings-button:hover {
      background: rgba(50, 50, 50, 0.95);
    }
    
    .edit-toggle.active {
      background: #667eea;
      border-color: #667eea;
    }
  }
</style>
