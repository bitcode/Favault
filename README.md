# Project Technical Overview

A fast, lightweight, and configurable bookmark manager new tab browser extension.

## Key Technical Components

### UI Framework: Svelte

*   **Implementation**: The user interface is built with Svelte, configured via [`svelte.config.js`](./svelte.config.js). The main entry point for the UI is [`src/App.svelte`](./src/App.svelte).
*   **State Management**: The application utilizes Svelte's reactive stores for state management, defined in [`src/lib/stores.ts`](./src/lib/stores.ts).

### Testing Framework: Playwright

*   **Configuration**: End-to-end testing is managed by Playwright, with an extensive configuration in [`playwright.config.ts`](./playwright.config.ts) that defines projects for multiple browsers (Chrome, Firefox, Edge).
*   **Test Suites**: The framework includes a comprehensive test suite with a strong focus on validating complex drag-and-drop functionality, covering positioning accuracy, data consistency, and regression testing.
*   **Utilities**: The testing framework is supported by custom fixtures and sophisticated utilities for generating and managing test data, located in [`tests/playwright/utils/`](./tests/playwright/utils/).

### Language: TypeScript

*   **Configuration**: The project is written in TypeScript, with a strict type-checking configuration defined in [`tsconfig.json`](./tsconfig.json).
*   **Architecture**: The configuration supports a module-based architecture with path aliases to simplify imports from the `src/` directory.

### Browser Extension Architecture

*   **Manifests**: The extension supports multiple browsers through a set of dedicated manifest files in the [`manifests/`](./manifests/) directory. A [`manifest-base.json`](./manifests/manifest-base.json) is dynamically configured for target browsers during the build process. The manifests define permissions (bookmarks, storage), the new tab page override, and the background service worker.
*   **Source Directory (`src/`)**:
    *   [`main.ts`](./src/main.ts): The main entry point for the application, responsible for initializing the Svelte app.
    *   [`App.svelte`](./src/App.svelte): The root Svelte component that defines the overall layout and orchestrates the UI.
    *   [`service-worker.ts`](./src/service-worker.ts): A service worker that manages background tasks, keyboard shortcuts, and communication between different parts of the extension.
    *   **`lib/`**: A library of modules encapsulating the core application logic:
        *   [`bookmarks.ts`](./src/lib/bookmarks.ts): Manages fetching, caching, and organizing bookmarks.
        *   [`dragdrop.ts`](./src/lib/dragdrop.ts) and [`dragdrop-enhanced.ts`](./src/lib/dragdrop-enhanced.ts): A multi-layered system for managing drag-and-drop functionality.
        *   [`api.ts`](./src/lib/api.ts): A wrapper for the browser's extension APIs.
