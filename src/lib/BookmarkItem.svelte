<script lang="ts">
  import type { BookmarkItem } from './api';
  
  export let bookmark: BookmarkItem;
  
  // Generate favicon URL
  function getFaviconUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return '';
    }
  }
  
  // Handle favicon load error
  function handleFaviconError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
  
  // Handle bookmark click
  function handleClick() {
    if (bookmark.url) {
      window.open(bookmark.url, '_blank');
    }
  }
  
  // Get domain from URL for display
  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
</script>

<div class="bookmark-item" on:click={handleClick} on:keydown={(e) => e.key === 'Enter' && handleClick()} tabindex="0" role="button">
  <div class="favicon-container">
    {#if bookmark.url}
      <img
        src={getFaviconUrl(bookmark.url)}
        alt=""
        class="favicon"
        on:error={handleFaviconError}
      />
    {/if}
    <div class="favicon-fallback">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
    </div>
  </div>
  
  <div class="bookmark-content">
    <div class="bookmark-title" title={bookmark.title}>
      {bookmark.title}
    </div>
    {#if bookmark.url}
      <div class="bookmark-url" title={bookmark.url}>
        {getDomain(bookmark.url)}
      </div>
    {/if}
  </div>
</div>

<style>
  .bookmark-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .bookmark-item:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  .bookmark-item:focus {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }
  
  .favicon-container {
    position: relative;
    width: 24px;
    height: 24px;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .favicon {
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }
  
  .favicon-fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    color: #666;
  }
  
  .favicon-fallback svg {
    width: 14px;
    height: 14px;
  }
  
  .favicon:not([style*="display: none"]) + .favicon-fallback {
    display: none;
  }
  
  .bookmark-content {
    flex: 1;
    min-width: 0;
  }
  
  .bookmark-title {
    font-weight: 500;
    color: #333;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.95rem;
  }
  
  .bookmark-url {
    font-size: 0.8rem;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  @media (prefers-color-scheme: dark) {
    .bookmark-item {
      background: rgba(40, 40, 40, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }
    
    .bookmark-item:hover {
      background: rgba(50, 50, 50, 0.9);
    }
    
    .bookmark-title {
      color: #fff;
    }
    
    .bookmark-url {
      color: #aaa;
    }
    
    .favicon-fallback {
      background: rgba(255, 255, 255, 0.1);
      color: #aaa;
    }
  }
</style>
