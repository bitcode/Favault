<script lang="ts">
  import { onMount } from 'svelte';
  import { tabsPanelCollapsed, openTabs, bookmarkFolders, editMode } from './stores';
  import { TabsAPI, type OpenTab } from './api';
  import { FaviconManager } from './favicon-utils';
  import { DragDropManager } from './dragdrop';

  // Derive the set of already-bookmarked URLs from the store
  $: bookmarkedUrlSet = new Set<string>(
    $bookmarkFolders.flatMap(folder =>
      folder.bookmarks
        .filter(b => b.url)
        .flatMap(b => [b.url!, b.url!.replace(/\/$/, '')])
    )
  );

  // Filtered tabs: open tabs not already bookmarked
  $: filteredTabs = $openTabs.filter(tab => {
    const normalized = tab.url.replace(/\/$/, '');
    return !bookmarkedUrlSet.has(tab.url) && !bookmarkedUrlSet.has(normalized);
  });

  async function loadTabs() {
    const tabs = await TabsAPI.getUnbookmarkedTabs(bookmarkedUrlSet);
    openTabs.set(tabs);
  }

  function handleTabDragStart(e: DragEvent, tab: OpenTab) {
    if (!$editMode) {
      e.preventDefault();
      return;
    }
    if (!e.dataTransfer) return;
    const payload = {
      type: 'new-tab' as const,
      id: `tab-${tab.id}`,
      title: tab.title,
      url: tab.url
    };
    e.dataTransfer.setData('application/x-favault-bookmark', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', tab.url);
    e.dataTransfer.effectAllowed = 'copy';
    // Register in shared drag state so drop zones get correct dragData during dragenter/dragover
    DragDropManager.startExternalDrag(payload);
  }

  function handleTabDragEnd() {
    DragDropManager.endExternalDrag();
  }

  function handleFaviconError(e: Event) {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
  }

  function formatUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  onMount(() => {
    loadTabs();

    // Re-load tabs when bookmarks change (a tab just got bookmarked)
    const unsubscribe = bookmarkFolders.subscribe(() => {
      // Reactivity handles filteredTabs automatically; just need openTabs fresh
      // when the panel is open to catch newly bookmarked items
      if (!$tabsPanelCollapsed) {
        loadTabs();
      }
    });

    return unsubscribe;
  });
</script>

<div class="tabs-panel" class:collapsed={$tabsPanelCollapsed}>
  <!-- Toggle tab -->
  <button
    class="tabs-toggle"
    on:click={() => {
      tabsPanelCollapsed.update(v => !v);
      if (!$tabsPanelCollapsed) loadTabs();
    }}
    title={$tabsPanelCollapsed ? 'Show open tabs' : 'Hide open tabs'}
    aria-label={$tabsPanelCollapsed ? 'Show open tabs panel' : 'Hide open tabs panel'}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"></rect>
      <path d="M8 21h8M12 17v4"></path>
    </svg>
    {#if !$tabsPanelCollapsed}
      <span class="toggle-label">Open Tabs</span>
    {/if}
  </button>

  {#if !$tabsPanelCollapsed}
    <div class="tabs-panel-inner">
      <div class="tabs-header">
        <span class="tabs-title">Open Tabs</span>
        <span class="tab-count">{filteredTabs.length}</span>
        <button class="refresh-btn" on:click={loadTabs} title="Refresh tab list" aria-label="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      {#if $editMode}
        <p class="tabs-hint">Drag a tab into a bookmark folder to save it.</p>
      {:else}
        <p class="tabs-hint">Enter edit mode to drag tabs into folders.</p>
      {/if}

      <div class="tabs-list" role="list">
        {#if filteredTabs.length === 0}
          <p class="tabs-empty">All open tabs are already bookmarked!</p>
        {:else}
          {#each filteredTabs as tab (tab.id)}
            <div
              class="tab-item"
              class:active={tab.active}
              class:draggable={$editMode}
              draggable={$editMode}
              role="listitem"
              on:dragstart={(e) => handleTabDragStart(e, tab)}
              on:dragend={handleTabDragEnd}
              title="{tab.title}\n{tab.url}\n\nDrag to a bookmark folder to save"
            >
              <div class="tab-favicon-wrap">
                {#if tab.favIconUrl}
                  <img
                    class="tab-favicon"
                    src={tab.favIconUrl}
                    alt=""
                    on:error={handleFaviconError}
                    loading="lazy"
                  />
                {:else}
                  <img
                    class="tab-favicon"
                    src={FaviconManager.getFaviconUrl(tab.url, { size: 16, skipLocalUrls: true, skipSpecialUrls: true })}
                    alt=""
                    on:error={handleFaviconError}
                    loading="lazy"
                  />
                {/if}
                <div class="tab-favicon-fallback">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
              </div>
              <div class="tab-info">
                <span class="tab-title">{tab.title}</span>
                <span class="tab-url">{formatUrl(tab.url)}</span>
              </div>
              <div class="drag-handle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="7" r="1.5"></circle><circle cx="15" cy="7" r="1.5"></circle>
                  <circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle>
                  <circle cx="9" cy="17" r="1.5"></circle><circle cx="15" cy="17" r="1.5"></circle>
                </svg>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .tabs-panel {
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 500;
    width: 260px;
    max-height: 70vh;
    display: flex;
    flex-direction: row;
    background: var(--theme-panel);
    border: 1px solid var(--theme-border);
    border-left: none;
    border-radius: 0 12px 12px 0;
    box-shadow: 4px 0 24px var(--theme-shadow, rgba(0,0,0,0.15));
    backdrop-filter: blur(12px);
    transition: width 0.25s ease, box-shadow 0.2s ease;
    overflow: hidden;
  }


  .tabs-panel.collapsed {
    width: 40px;
    background: var(--theme-panel);
  }

  /* The vertical toggle button on the right edge of the panel */
  .tabs-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 40px;
    min-width: 40px;
    padding: 1rem 0;
    background: none;
    border: none;
    border-right: 1px solid var(--theme-border);
    color: var(--theme-text-secondary);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
    flex-shrink: 0;
  }

  .tabs-toggle:hover {
    color: var(--theme-accent);
    background: var(--theme-bg-accent-soft, rgba(0,0,0,0.05));
  }

  .tabs-toggle svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .toggle-label {
    writing-mode: vertical-lr;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-text-muted);
    transform: rotate(180deg);
  }

  /* Expanded panel content */
  .tabs-panel-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .tabs-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.75rem 0.5rem;
    border-bottom: 1px solid var(--theme-border);
    flex-shrink: 0;
  }

  .tabs-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--theme-text-primary);
    flex: 1;
  }

  .tab-count {
    font-size: 0.7rem;
    background: var(--theme-accent);
    color: var(--theme-accent-contrast, #fff);
    border-radius: 10px;
    padding: 1px 7px;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    padding: 0;
  }

  .refresh-btn:hover {
    color: var(--theme-accent);
    background: var(--theme-bg-accent-soft, rgba(0,0,0,0.05));
  }

  .refresh-btn svg {
    width: 13px;
    height: 13px;
  }

  .tabs-hint {
    font-size: 0.7rem;
    color: var(--theme-text-muted);
    padding: 0.4rem 0.75rem;
    margin: 0;
    flex-shrink: 0;
    line-height: 1.3;
  }

  .tabs-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.5rem 0.5rem;
  }

  .tabs-empty {
    font-size: 0.8rem;
    color: var(--theme-text-muted);
    text-align: center;
    padding: 1.5rem 0.5rem;
    margin: 0;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.4rem;
    border-radius: 6px;
    cursor: default;
    transition: background 0.15s ease;
    margin-bottom: 2px;
    position: relative;
  }

  .tab-item.draggable {
    cursor: grab;
  }

  .tab-item:hover {
    background: var(--theme-bg-accent-soft, rgba(0,0,0,0.06));
  }

  .tab-item.draggable:active {
    cursor: grabbing;
  }

  .tab-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    background: var(--theme-accent);
    border-radius: 0 2px 2px 0;
  }

  .tab-favicon-wrap {
    position: relative;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .tab-favicon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    display: block;
  }

  .tab-favicon-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted);
    pointer-events: none;
  }

  .tab-favicon-fallback svg {
    width: 12px;
    height: 12px;
  }

  .tab-favicon:not([style*="display: none"]) + .tab-favicon-fallback {
    display: none;
  }

  .tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .tab-title {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--theme-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .tab-url {
    font-size: 0.68rem;
    color: var(--theme-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .drag-handle {
    color: var(--theme-text-muted);
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .tab-item.draggable:hover .drag-handle {
    opacity: 0.6;
  }

  .drag-handle svg {
    width: 12px;
    height: 12px;
  }

  /* Scrollbar styling */
  .tabs-list::-webkit-scrollbar {
    width: 4px;
  }

  .tabs-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .tabs-list::-webkit-scrollbar-thumb {
    background: var(--theme-border);
    border-radius: 2px;
  }
</style>
