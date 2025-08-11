<script lang="ts">
  import { onMount } from 'svelte';
  import SearchBar from './lib/SearchBar.svelte';
  import BookmarkFolder from './lib/BookmarkFolder.svelte';
  import { BookmarkManager } from './lib/bookmarks';
  import { bookmarkFolders, filteredBookmarks, isLoading, error } from './lib/stores';
  
  let searchBarComponent: SearchBar;
  
  // Load bookmarks on component mount
  onMount(() => {
    // Hide the HTML loading fallback now that Svelte is mounting
    const fallback = document.querySelector('.loading-fallback');
    if (fallback) {
      fallback.classList.add('hidden');
    }

    // Set up keyboard shortcut listener
    document.addEventListener('keydown', handleKeydown);

    // Load bookmarks asynchronously
    loadBookmarks();

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  // Separate async function for loading bookmarks
  async function loadBookmarks() {
    try {
      isLoading.set(true);
      error.set(null);

      const folders = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.set(folders);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      error.set('Failed to load bookmarks. Please check extension permissions.');
    } finally {
      isLoading.set(false);
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd + F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      if (searchBarComponent) {
        searchBarComponent.focusSearch();
      }
    }
  }
  
  // Refresh bookmarks
  async function refreshBookmarks() {
    try {
      isLoading.set(true);
      error.set(null);
      BookmarkManager.clearCache();
      
      const folders = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.set(folders);
    } catch (err) {
      console.error('Failed to refresh bookmarks:', err);
      error.set('Failed to refresh bookmarks.');
    } finally {
      isLoading.set(false);
    }
  }
</script>

<main class="app">
  <div class="container">
    <header class="header">
      <h1 class="title">FaVault</h1>
      <p class="subtitle">Your personalized bookmark hub</p>
    </header>
    
    <SearchBar bind:this={searchBarComponent} />
    
    {#if $isLoading}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading your bookmarks...</p>
      </div>
    {:else if $error}
      <div class="error">
        <div class="error-icon">⚠️</div>
        <p>{$error}</p>
        <button class="retry-button" on:click={refreshBookmarks}>
          Try Again
        </button>
      </div>
    {:else if $filteredBookmarks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No bookmarks found</h3>
        <p>Start bookmarking your favorite sites to see them here!</p>
      </div>
    {:else}
      <div class="bookmarks-container">
        {#each $filteredBookmarks as folder (folder.id)}
          <BookmarkFolder {folder} />
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    overflow-x: hidden;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem 1rem;
    position: relative;
  }
  
  .app::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  
  .header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  .title {
    font-size: 3rem;
    font-weight: 700;
    color: white;
    margin: 0 0 0.5rem 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    letter-spacing: -0.02em;
  }
  
  .subtitle {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    font-weight: 300;
  }
  
  .loading {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .retry-button {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 1rem;
    transition: all 0.2s ease;
  }
  
  .retry-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }
  
  .empty-state p {
    font-size: 1.1rem;
    opacity: 0.8;
    margin: 0;
  }
  
  .bookmarks-container {
    animation: fadeIn 0.5s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .app {
      padding: 1rem 0.5rem;
    }
    
    .title {
      font-size: 2.5rem;
    }
    
    .subtitle {
      font-size: 1rem;
    }
    
    .header {
      margin-bottom: 2rem;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .app {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    }
  }
</style>
