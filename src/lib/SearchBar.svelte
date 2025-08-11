<script lang="ts">
  import { searchQuery, uiState, searchResultsCount } from './stores';
  import { ExtensionAPI } from './api';
  
  let searchInput: HTMLInputElement;
  let debounceTimer: number;
  
  // Debounced search function
  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery.set(value);
    }, 300);
  }
  
  // Focus search input
  export function focusSearch() {
    if (searchInput) {
      searchInput.focus();
      uiState.update(state => ({ ...state, searchFocused: true }));
    }
  }
  
  // Handle search input focus/blur
  function handleFocus() {
    uiState.update(state => ({ ...state, searchFocused: true }));
  }
  
  function handleBlur() {
    uiState.update(state => ({ ...state, searchFocused: false }));
  }
  
  // Listen for messages from service worker
  ExtensionAPI.onMessage((message) => {
    if (message.type === 'FOCUS_SEARCH') {
      focusSearch();
    }
  });
  
  // Clear search
  function clearSearch() {
    searchQuery.set('');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }
</script>

<div class="search-container">
  <div class="search-wrapper">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
    
    <input
      bind:this={searchInput}
      type="text"
      placeholder="Search bookmarks..."
      class="search-input"
      on:input={handleSearch}
      on:focus={handleFocus}
      on:blur={handleBlur}
    />
    
    {#if $searchQuery}
      <button class="clear-button" on:click={clearSearch} title="Clear search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>
  
  {#if $searchQuery && $searchResultsCount > 0}
    <div class="search-results-info">
      {$searchResultsCount} bookmark{$searchResultsCount !== 1 ? 's' : ''} found
    </div>
  {/if}
  
  {#if $searchQuery && $searchResultsCount === 0}
    <div class="no-results">
      No bookmarks found for "{$searchQuery}"
    </div>
  {/if}
</div>

<style>
  .search-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto 2rem;
  }
  
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }
  
  .search-wrapper:focus-within {
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  .search-icon {
    width: 20px;
    height: 20px;
    color: #666;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 1.1rem;
    color: #333;
    font-weight: 400;
  }
  
  .search-input::placeholder {
    color: #999;
  }
  
  .clear-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: all 0.2s ease;
  }
  
  .clear-button:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }
  
  .clear-button svg {
    width: 16px;
    height: 16px;
  }
  
  .search-results-info {
    text-align: center;
    margin-top: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
  }
  
  .no-results {
    text-align: center;
    margin-top: 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1rem;
  }
  
  @media (prefers-color-scheme: dark) {
    .search-wrapper {
      background: rgba(40, 40, 40, 0.9);
    }
    
    .search-input {
      color: #fff;
    }
    
    .search-input::placeholder {
      color: #aaa;
    }
    
    .search-icon {
      color: #aaa;
    }
    
    .clear-button {
      color: #aaa;
    }
    
    .clear-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
  }
</style>
