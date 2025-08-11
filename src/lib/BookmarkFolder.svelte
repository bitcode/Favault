<script lang="ts">
  import { onMount } from 'svelte';
  import BookmarkItem from './BookmarkItem.svelte';
  import type { BookmarkFolder } from './api';
  
  export let folder: BookmarkFolder;
  export let isVisible = true;
  
  let isExpanded = true;
  let folderElement: HTMLElement;
  let observer: IntersectionObserver;
  
  // Toggle folder expansion
  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
  
  // Set up intersection observer for lazy loading
  onMount(() => {
    if (folderElement && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              isVisible = true;
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '100px' }
      );
      
      observer.observe(folderElement);
    }
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  });
</script>

<div class="folder-container" bind:this={folderElement}>
  <div class="folder-header" on:click={toggleExpanded} on:keydown={(e) => e.key === 'Enter' && toggleExpanded()} tabindex="0" role="button">
    <div class="folder-color" style="background-color: {folder.color}"></div>
    <h3 class="folder-title">{folder.title}</h3>
    <div class="bookmark-count">({folder.bookmarks.length})</div>
    <div class="expand-icon" class:expanded={isExpanded}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="6,9 12,15 18,9"></polyline>
      </svg>
    </div>
  </div>
  
  {#if isExpanded && isVisible}
    <div class="bookmarks-grid" class:expanded={isExpanded}>
      {#each folder.bookmarks as bookmark (bookmark.id)}
        <BookmarkItem {bookmark} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .folder-container {
    margin-bottom: 2rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }
  
  .folder-header {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.05);
  }
  
  .folder-header:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .folder-header:focus {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: -2px;
  }
  
  .folder-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 0.75rem;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .folder-title {
    flex: 1;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .bookmark-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin-right: 0.5rem;
  }
  
  .expand-icon {
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.7);
    transition: transform 0.2s ease;
  }
  
  .expand-icon.expanded {
    transform: rotate(180deg);
  }
  
  .expand-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .bookmarks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    padding: 1.25rem;
    animation: slideDown 0.3s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .bookmarks-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      padding: 1rem;
    }
    
    .folder-header {
      padding: 0.75rem 1rem;
    }
    
    .folder-title {
      font-size: 1rem;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .folder-container {
      background: rgba(20, 20, 20, 0.3);
      border-color: rgba(255, 255, 255, 0.1);
    }
    
    .folder-header {
      background: rgba(0, 0, 0, 0.2);
    }
    
    .folder-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }
  }
</style>
