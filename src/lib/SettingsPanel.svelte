<script lang="ts">
  import { settingsVisible, userSettings, editMode, settingsManager } from './stores';
  import { themes } from './themes';
  
  let activeTab = 'general';
  
  // Close settings panel
  function closeSettings(event?: Event) {
    if (event && event.target !== event.currentTarget) {
      return;
    }
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
  <button class="settings-overlay" on:click={closeSettings} on:keydown|self={handleKeydown}>
    <div class="settings-panel" role="document">
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
            <p class="setting-description theme-section-description">
              Three light/dark pairs are available now. The JM pair is scaffolded and ready to
              be refined once the final brand palette is confirmed from the PDF.
            </p>
            <div class="theme-grid">
              {#each themes as theme}
                <button
                  class="theme-option"
                  class:active={$userSettings.theme.selectedTheme === theme.id}
                  on:click={() => changeTheme(theme.id)}
                >
                  <div
                    class="theme-preview"
                    style={`--preview-start:${theme.colors.bgStart}; --preview-end:${theme.colors.bgEnd}; --preview-accent:${theme.colors.accent}; --preview-panel:${theme.colors.panelSolid};`}
                  >
                    <span class="preview-chip"></span>
                    <span class="preview-line"></span>
                    <span class="preview-line short"></span>
                  </div>
                  <span>{theme.name}</span>
                  <small>{theme.mode === 'dark' ? 'Dark pair' : 'Light pair'}</small>
                </button>
              {/each}
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
  </button>
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
    border: none;
    padding: 0;
    font: inherit;
    text-align: inherit;
    cursor: default;
    width: 100%;
  }
  
  .settings-panel {
    background: var(--theme-panel, rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(20px);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 40px var(--theme-shadow, rgba(0, 0, 0, 0.2));
    animation: slideIn 0.3s ease-out;
    color: var(--theme-text-primary, #333);
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--theme-border, rgba(0, 0, 0, 0.1));
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text-primary, #333);
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
    background: var(--theme-panel-muted, rgba(0, 0, 0, 0.1));
  }
  
  .close-button svg {
    width: 20px;
    height: 20px;
    color: var(--theme-text-muted, #666);
  }
  
  .settings-tabs {
    display: flex;
    border-bottom: 1px solid var(--theme-border, rgba(0, 0, 0, 0.1));
  }
  
  .tab-button {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--theme-text-muted, #666);
    transition: all 0.2s ease;
    position: relative;
  }
  
  .tab-button:hover {
    background: var(--theme-panel-muted, rgba(0, 0, 0, 0.05));
    color: var(--theme-text-primary, #333);
  }
  
  .tab-button.active {
    color: var(--theme-accent, #667eea);
  }
  
  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--theme-accent, #667eea);
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
    color: var(--theme-text-primary, #333);
  }
  
  .setting-item {
    margin-bottom: 1.5rem;
  }
  
  .setting-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
    color: var(--theme-text-primary, #333);
  }
  
  .setting-label input[type="checkbox"] {
    display: none;
  }
  
  .checkbox-custom {
    width: 20px;
    height: 20px;
    border: 2px solid var(--theme-border, #ddd);
    border-radius: 4px;
    margin-right: 0.75rem;
    position: relative;
    transition: all 0.2s ease;
  }
  
  .setting-label input[type="checkbox"]:checked + .checkbox-custom {
    background: var(--theme-accent, #667eea);
    border-color: var(--theme-accent, #667eea);
  }
  
  .setting-label input[type="checkbox"]:checked + .checkbox-custom::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--theme-accent-contrast, white);
    font-size: 12px;
    font-weight: bold;
  }
  
  .setting-description {
    margin: 0.5rem 0 0 2.75rem;
    font-size: 0.85rem;
    color: var(--theme-text-muted, #666);
    line-height: 1.4;
  }
  
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1rem;
    background: var(--theme-panel-muted, transparent);
    border: 2px solid var(--theme-border, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: inherit;
    text-align: center;
  }

  .theme-option:hover {
    border-color: var(--theme-border-strong, rgba(0, 0, 0, 0.2));
    transform: translateY(-2px);
  }

  .theme-option.active {
    border-color: var(--theme-accent, #667eea);
    background: color-mix(in srgb, var(--theme-accent, #667eea) 12%, var(--theme-panel-muted, transparent));
  }

  .theme-preview {
    width: 100%;
    height: 82px;
    border-radius: 10px;
    margin-bottom: 0.25rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, var(--preview-start) 0%, var(--preview-end) 100%);
    border: 1px solid color-mix(in srgb, var(--preview-panel) 55%, white);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.35rem;
    align-items: flex-start;
    position: relative;
    overflow: hidden;
  }

  .theme-preview::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at top right, color-mix(in srgb, var(--preview-accent) 38%, transparent), transparent 45%);
  }

  .preview-chip {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--preview-accent);
    border: 2px solid color-mix(in srgb, var(--preview-panel) 65%, white);
    position: relative;
    z-index: 1;
  }

  .preview-line {
    width: 72%;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--preview-panel) 78%, white);
    position: relative;
    z-index: 1;
  }

  .preview-line.short {
    width: 46%;
  }

  .theme-option span {
    font-weight: 600;
    color: var(--theme-text-primary, #333);
  }

  .theme-option small {
    color: var(--theme-text-muted, #666);
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
    border: 2px solid var(--theme-border, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
  }
  
  .layout-option:hover {
    border-color: var(--theme-border-strong, rgba(0, 0, 0, 0.2));
    transform: translateY(-2px);
  }

  .layout-option.active {
    border-color: var(--theme-accent, #667eea);
    background: color-mix(in srgb, var(--theme-accent, #667eea) 12%, transparent);
  }
  
  .layout-icon {
    width: 40px;
    height: 30px;
    margin-bottom: 0.5rem;
    background: var(--theme-border, #ddd);
    border-radius: 4px;
  }
  
  .grid-icon {
    background: repeating-conic-gradient(var(--theme-border, #ddd) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
  }
  
  .list-icon {
    background: repeating-linear-gradient(to bottom, var(--theme-border, #ddd) 0px 4px, transparent 4px 8px);
  }
  
  .tags-icon {
    background: radial-gradient(circle at 25% 25%, var(--theme-border, #ddd) 2px, transparent 2px),
                radial-gradient(circle at 75% 25%, var(--theme-border, #ddd) 2px, transparent 2px),
                radial-gradient(circle at 25% 75%, var(--theme-border, #ddd) 2px, transparent 2px);
    background-size: 15px 15px;
  }
  
  .settings-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--theme-border, rgba(0, 0, 0, 0.1));
    display: flex;
    justify-content: flex-end;
  }
  
  .reset-button {
    padding: 0.75rem 1.5rem;
    background: var(--theme-danger, #f44336);
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .reset-button:hover {
    filter: brightness(0.92);
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
  
  .theme-section-description {
    margin: 0 0 1rem;
  }
</style>
