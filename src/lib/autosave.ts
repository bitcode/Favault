// Auto-save utility for bookmark editing
export interface AutoSaveOptions {
  delay?: number; // Delay in milliseconds before auto-save triggers
  onSave?: () => Promise<void>; // Function to call when auto-save triggers
  onSaveStart?: () => void; // Function to call when save starts
  onSaveComplete?: (success: boolean, error?: string) => void; // Function to call when save completes
}

export interface AutoSaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export class AutoSaveManager {
  private timeoutId: number | null = null;
  private options: Required<AutoSaveOptions>;
  private state: AutoSaveState = {
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null
  };
  private listeners: ((state: AutoSaveState) => void)[] = [];

  constructor(options: AutoSaveOptions = {}) {
    this.options = {
      delay: options.delay || 2000, // Default 2 seconds
      onSave: options.onSave || (() => Promise.resolve()),
      onSaveStart: options.onSaveStart || (() => {}),
      onSaveComplete: options.onSaveComplete || (() => {})
    };
  }

  /**
   * Mark content as dirty and schedule auto-save
   */
  markDirty(): void {
    this.updateState({ isDirty: true, error: null });
    this.scheduleAutoSave();
  }

  /**
   * Mark content as clean (saved)
   */
  markClean(): void {
    this.updateState({ 
      isDirty: false, 
      lastSaved: new Date(),
      error: null 
    });
    this.cancelAutoSave();
  }

  /**
   * Force immediate save
   */
  async forceSave(): Promise<boolean> {
    this.cancelAutoSave();
    return await this.performSave();
  }

  /**
   * Cancel any pending auto-save
   */
  cancelAutoSave(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Get current auto-save state
   */
  getState(): AutoSaveState {
    return { ...this.state };
  }

  /**
   * Add state change listener
   */
  addListener(listener: (state: AutoSaveState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove state change listener
   */
  removeListener(listener: (state: AutoSaveState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancelAutoSave();
    this.listeners.length = 0;
  }

  /**
   * Schedule auto-save after delay
   */
  private scheduleAutoSave(): void {
    this.cancelAutoSave();
    
    this.timeoutId = window.setTimeout(async () => {
      await this.performSave();
    }, this.options.delay);
  }

  /**
   * Perform the actual save operation
   */
  private async performSave(): Promise<boolean> {
    if (this.state.isSaving || !this.state.isDirty) {
      return true;
    }

    this.updateState({ isSaving: true, error: null });
    this.options.onSaveStart();

    try {
      await this.options.onSave();
      this.updateState({ 
        isDirty: false, 
        isSaving: false, 
        lastSaved: new Date(),
        error: null 
      });
      this.options.onSaveComplete(true);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      this.updateState({ 
        isSaving: false, 
        error: errorMessage 
      });
      this.options.onSaveComplete(false, errorMessage);
      return false;
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<AutoSaveState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in auto-save state listener:', error);
      }
    });
  }
}

// Utility function to create debounced input handler
export function createDebouncedInput(
  callback: (value: string) => void,
  delay: number = 300
): (event: Event) => void {
  let timeoutId: number | null = null;

  return (event: Event) => {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(value);
    }, delay);
  };
}

// Utility function to format time since last save
export function formatTimeSince(date: Date | null): string {
  if (!date) return 'Never saved';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'Just saved';
  } else if (diffMinutes < 60) {
    return `Saved ${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `Saved ${diffHours}h ago`;
  } else {
    return `Saved ${Math.floor(diffHours / 24)}d ago`;
  }
}

// Auto-save status component data
export interface AutoSaveStatusData {
  state: AutoSaveState;
  statusText: string;
  statusClass: string;
}

export function getAutoSaveStatusData(state: AutoSaveState): AutoSaveStatusData {
  let statusText: string;
  let statusClass: string;

  if (state.isSaving) {
    statusText = 'Saving...';
    statusClass = 'saving';
  } else if (state.error) {
    statusText = `Error: ${state.error}`;
    statusClass = 'error';
  } else if (state.isDirty) {
    statusText = 'Unsaved changes';
    statusClass = 'dirty';
  } else if (state.lastSaved) {
    statusText = formatTimeSince(state.lastSaved);
    statusClass = 'saved';
  } else {
    statusText = 'Not saved';
    statusClass = 'not-saved';
  }

  return {
    state,
    statusText,
    statusClass
  };
}
