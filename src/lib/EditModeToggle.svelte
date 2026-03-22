<script lang="ts">
  import { editMode, settingsManager } from './stores';

  async function toggleEditMode() {
    const newEditMode = !$editMode;
    await settingsManager.updateEditMode({ enabled: newEditMode });
  }
</script>

<button
  class="edit-toggle"
  class:active={$editMode}
  on:click={toggleEditMode}
  title={$editMode ? 'Exit edit mode (Ctrl+E)' : 'Enter edit mode (Ctrl+E)'}
>
  {#if $editMode}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20,6 9,17 4,12"></polyline>
    </svg>
    <span>Done</span>
  {:else}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    <span>Edit</span>
  {/if}
</button>

<style>
  .edit-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.1rem;
    background: var(--theme-input-bg, rgba(255,255,255,0.9));
    border: 1px solid var(--theme-border, transparent);
    border-radius: 12px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    color: var(--theme-input-text, #333);
    box-shadow: 0 4px 20px var(--theme-shadow, rgba(0,0,0,0.1));
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .edit-toggle:hover {
    box-shadow: 0 6px 30px var(--theme-shadow, rgba(0,0,0,0.15));
    border-color: var(--theme-border-strong, transparent);
    transform: translateY(-2px);
  }

  .edit-toggle.active {
    background: var(--theme-accent, #667eea);
    border-color: var(--theme-accent, #667eea);
    color: var(--theme-accent-contrast, #fff);
    box-shadow: 0 4px 20px var(--theme-shadow, rgba(0,0,0,0.15));
  }

  .edit-toggle.active:hover {
    filter: brightness(1.08);
    transform: translateY(-2px);
  }

  .edit-toggle svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>
