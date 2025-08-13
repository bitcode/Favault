<script lang="ts">
  import { settingsVisible, userSettings, editMode, settingsManager } from './stores';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let activeTab = 'general';
  
  // Close settings panel
  function closeSettings() {
    settingsVisible.set(false);
  }
  
  // Handle tab switching
  function switchTab(tab: string) {
    activeTab = tab;
  }
  
  // Handle edit mode toggle
  async function toggleEditMode() {
    const newEditMode = !$editMode;
    editMode.set(newEditMode);
    await settingsManager.updateEditMode({ enabled: newEditMode });
  }
  
  // Handle layout mode change
  async function changeLayoutMode(mode: 'compact' | 'grid' | 'tags') {
    await settingsManager.updateLayout({ viewMode: mode });
  }
  
  // Handle theme change
  async function changeTheme(theme: string) {
    await settingsManager.updateTheme({ selectedTheme: theme });
  }
  
  // Reset all settings
  async function resetAllSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await settingsManager.resetSettings();
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeSettings();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $settingsVisible}
  <div class="settings-overlay" on:click={closeSettings}>
    <div class="settings-panel" on:click|stopPropagation>
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-button" on:click={closeSettings} title="Close settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="settings-tabs">
        <button 
          class="tab-button" 
          class:active={activeTab === 'general'}
          on:click={() => switchTab('general')}
        >
          General
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'theme'}
          on:click={() => switchTab('theme')}
        >
          Theme
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'layout'}
          on:click={() => switchTab('layout')}
        >
          Layout
        </button>
      </div>
      
      <div class="settings-content">
        {#if activeTab === 'general'}
          <div class="settings-section">
            <h3>Edit Mode</h3>
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  checked={$editMode}
                  on:change={toggleEditMode}
                />
                <span class="checkbox-custom"></span>
                Enable edit mode
              </label>
              <p class="setting-description">
                Allow editing bookmarks, reordering, and customization
              </p>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  checked={$userSettings.editMode.autoSave}
                  on:change={() => settingsManager.updateEditMode({ autoSave: !$userSettings.editMode.autoSave })}
                />
                <span class="checkbox-custom"></span>
                Auto-save changes
              </label>
              <p class="setting-description">
                Automatically save changes without confirmation
              </p>
            </div>
          </div>
        {/if}
        
        {#if activeTab === 'theme'}
          <div class="settings-section">
            <h3>Theme Selection</h3>
            <div class="theme-grid">
              <button 
                class="theme-option" 
                class:active={$userSettings.theme.selectedTheme === 'default'}
                on:click={() => changeTheme('default')}
              >
                <div class="theme-preview default-theme"></div>
                <span>Default</span>
              </button>
              <button 
                class="theme-option" 
                class:active={$userSettings.theme.selectedTheme === 'dark'}
                on:click={() => changeTheme('dark')}
              >
                <div class="theme-preview dark-theme"></div>
                <span>Dark</span>
              </button>
              <button 
                class="theme-option" 
                class:active={$userSettings.theme.selectedTheme === 'ocean'}
                on:click={() => changeTheme('ocean')}
              >
                <div class="theme-preview ocean-theme"></div>
                <span>Ocean</span>
              </button>
            </div>
          </div>
        {/if}
        
        {#if activeTab === 'layout'}
          <div class="settings-section">
            <h3>View Mode</h3>
            <div class="layout-options">
              <button 
                class="layout-option" 
                class:active={$userSettings.layout.viewMode === 'grid'}
                on:click={() => changeLayoutMode('grid')}
              >
                <div class="layout-icon grid-icon"></div>
                <span>Grid</span>
              </button>
              <button 
                class="layout-option" 
                class:active={$userSettings.layout.viewMode === 'compact'}
                on:click={() => changeLayoutMode('compact')}
              >
                <div class="layout-icon list-icon"></div>
                <span>Compact</span>
              </button>
              <button 
                class="layout-option" 
                class:active={$userSettings.layout.viewMode === 'tags'}
                on:click={() => changeLayoutMode('tags')}
              >
                <div class="layout-icon tags-icon"></div>
                <span>Tags</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="settings-footer">
        <button class="reset-button" on:click={resetAllSettings}>
          Reset to Defaults
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }
  
  .settings-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease-out;
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }
  
  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  
  .close-button svg {
    width: 20px;
    height: 20px;
    color: #666;
  }
  
  .settings-tabs {
    display: flex;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .tab-button {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: #666;
    transition: all 0.2s ease;
    position: relative;
  }
  
  .tab-button:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #333;
  }
  
  .tab-button.active {
    color: #667eea;
  }
  
  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #667eea;
  }
  
  .settings-content {
    padding: 2rem;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .settings-section {
    margin-bottom: 2rem;
  }
  
  .settings-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
  }
  
  .setting-item {
    margin-bottom: 1.5rem;
  }
  
  .setting-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
    color: #333;
  }
  
  .setting-label input[type="checkbox"] {
    display: none;
  }
  
  .checkbox-custom {
    width: 20px;
    height: 20px;
    border: 2px solid #ddd;
    border-radius: 4px;
    margin-right: 0.75rem;
    position: relative;
    transition: all 0.2s ease;
  }
  
  .setting-label input[type="checkbox"]:checked + .checkbox-custom {
    background: #667eea;
    border-color: #667eea;
  }
  
  .setting-label input[type="checkbox"]:checked + .checkbox-custom::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
  
  .setting-description {
    margin: 0.5rem 0 0 2.75rem;
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }
  
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }
  
  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: none;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .theme-option:hover {
    border-color: rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }
  
  .theme-option.active {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
  }
  
  .theme-preview {
    width: 60px;
    height: 40px;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }
  
  .default-theme {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  .dark-theme {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  
  .ocean-theme {
    background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
  }
  
  .layout-options {
    display: flex;
    gap: 1rem;
  }
  
  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: none;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
  }
  
  .layout-option:hover {
    border-color: rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }
  
  .layout-option.active {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
  }
  
  .layout-icon {
    width: 40px;
    height: 30px;
    margin-bottom: 0.5rem;
    background: #ddd;
    border-radius: 4px;
  }
  
  .grid-icon {
    background: repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%) 50% / 20px 20px;
  }
  
  .list-icon {
    background: repeating-linear-gradient(to bottom, #ddd 0px 4px, transparent 4px 8px);
  }
  
  .tags-icon {
    background: radial-gradient(circle at 25% 25%, #ddd 2px, transparent 2px),
                radial-gradient(circle at 75% 25%, #ddd 2px, transparent 2px),
                radial-gradient(circle at 25% 75%, #ddd 2px, transparent 2px);
    background-size: 15px 15px;
  }
  
  .settings-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: flex-end;
  }
  
  .reset-button {
    padding: 0.75rem 1.5rem;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .reset-button:hover {
    background: #d32f2f;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to { 
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .settings-panel {
      width: 95%;
      max-height: 90vh;
    }
    
    .settings-header {
      padding: 1rem 1.5rem;
    }
    
    .settings-content {
      padding: 1.5rem;
    }
    
    .theme-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .layout-options {
      flex-direction: column;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .settings-panel {
      background: rgba(40, 40, 40, 0.95);
    }
    
    .settings-header h2 {
      color: #fff;
    }
    
    .close-button svg {
      color: #aaa;
    }
    
    .tab-button {
      color: #aaa;
    }
    
    .tab-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    .settings-section h3 {
      color: #fff;
    }
    
    .setting-label {
      color: #fff;
    }
    
    .setting-description {
      color: #aaa;
    }
    
    .theme-option,
    .layout-option {
      border-color: rgba(255, 255, 255, 0.2);
    }
    
    .theme-option:hover,
    .layout-option:hover {
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
</style>
