/**
 * App Lifecycle Service
 * Handles browser/tab visibility changes and app backgrounding
 * Ensures proper state restoration when user returns to app
 */

type LifecycleCallback = () => void | Promise<void>;

class AppLifecycleService {
  private isAppVisible: boolean = true;
  private backgroundTime: number | null = null;

  private onResumeCallbacks: Set<LifecycleCallback> = new Set();
  private onBackgroundCallbacks: Set<LifecycleCallback> = new Set();

  constructor() {
    this.setupVisibilityListeners();
  }

  /**
   * Setup Page Visibility API listeners
   */
  private setupVisibilityListeners() {
    if (typeof document === 'undefined') return;

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleAppBackground();
      } else {
        this.handleAppResume();
      }
    });

    // Handle page focus/blur (additional safety)
    window.addEventListener('focus', () => {
      if (!this.isAppVisible) {
        this.handleAppResume();
      }
    });

    window.addEventListener('blur', () => {
      if (this.isAppVisible) {
        this.handleAppBackground();
      }
    });

    // Handle beforeunload (user closing tab)
    window.addEventListener('beforeunload', () => {
      this.persistCriticalState();
    });
  }

  /**
   * Called when app goes to background
   */
  private handleAppBackground() {
    console.log('🌙 App going to background');
    this.isAppVisible = false;
    this.backgroundTime = Date.now();

    // Persist critical state before backgrounding
    this.persistCriticalState();

    // Notify all listeners
    this.onBackgroundCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in background callback:', error);
      }
    });
  }

  /**
   * Called when app returns from background
   */
  private handleAppResume() {
    console.log('☀️ App resuming from background');

    const timeInBackground = this.backgroundTime
      ? Date.now() - this.backgroundTime
      : 0;

    console.log(`📊 App was in background for ${Math.round(timeInBackground / 1000)}s`);

    this.isAppVisible = true;
    this.backgroundTime = null;

    // Restore critical state
    this.restoreCriticalState();

    // Notify all listeners (with background duration)
    this.onResumeCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in resume callback:', error);
      }
    });
  }

  /**
   * Persist critical state to localStorage before backgrounding
   */
  private persistCriticalState() {
    const state = {
      lastActiveTime: Date.now(),
      wasActive: true,
    };

    try {
      localStorage.setItem('mf_app_lifecycle_state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist lifecycle state:', error);
    }
  }

  /**
   * Restore critical state when app resumes
   */
  private restoreCriticalState() {
    try {
      const stored = localStorage.getItem('mf_app_lifecycle_state');
      if (stored) {
        const state = JSON.parse(stored);
        console.log('♻️ Restored app state from:', new Date(state.lastActiveTime).toLocaleTimeString());
      }
    } catch (error) {
      console.error('Failed to restore lifecycle state:', error);
    }
  }

  /**
   * Register callback to run when app resumes from background
   */
  onResume(callback: LifecycleCallback) {
    this.onResumeCallbacks.add(callback);

    // Return cleanup function
    return () => {
      this.onResumeCallbacks.delete(callback);
    };
  }

  /**
   * Register callback to run when app goes to background
   */
  onBackground(callback: LifecycleCallback) {
    this.onBackgroundCallbacks.add(callback);

    // Return cleanup function
    return () => {
      this.onBackgroundCallbacks.delete(callback);
    };
  }

  /**
   * Check if app is currently visible
   */
  isVisible(): boolean {
    return this.isAppVisible;
  }

  /**
   * Get time app spent in background (in milliseconds)
   */
  getBackgroundDuration(): number {
    if (this.backgroundTime && !this.isAppVisible) {
      return Date.now() - this.backgroundTime;
    }
    return 0;
  }

  /**
   * Force trigger resume callbacks (for testing or manual recovery)
   */
  forceResume() {
    this.handleAppResume();
  }
}

// Export singleton instance
export const appLifecycleService = new AppLifecycleService();
