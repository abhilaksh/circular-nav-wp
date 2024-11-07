/**
 * Main Controller for Circular Navigation
 * Coordinates between all managers and handles core functionality
 */
import * as d3 from '../lib/d3.min.js';
import { StateManager } from '../state/StateManager.js';
import { DisplayManager } from '../state/DisplayManager.js';
import { CacheManager } from '../state/CacheManager.js';
import { VisualizationManager } from '../visualization/VisualizationManager.js';
import { NodeManager } from '../visualization/NodeManager.js';
import { PathManager } from '../visualization/PathManager.js';
import { OuterElementManager } from '../visualization/OuterElementManager.js';
import { ZoomManager } from '../visualization/ZoomManager.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Controls } from '../ui/Controls.js';
import { DEFAULT_CONFIG, validateConfig } from './config.js';
import { performance } from '../utils/performance.js';

export class CircularNavManager {
    /**
     * Creates a new CircularNavManager instance
     * @param {string} containerId - DOM element ID
     * @param {string} postType - WordPress post type
     * @param {Object} config - Configuration object
     */
    constructor(containerId, postType, config = {}) {
        console.log(`[CircularNav] Initializing Main Controller for ${containerId}`);
        // Validate inputs
        if (!containerId) throw new Error('Container ID is required');
        if (!postType) throw new Error('Post type is required');
        
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container ${containerId} not found`);

        // Core properties
        this.id = containerId;
        this.postType = postType;
        this.config = validateConfig({
                ...DEFAULT_CONFIG,
                ...config
            }) ? {
                ...DEFAULT_CONFIG,
                ...config
            } : DEFAULT_CONFIG;
        this.eventNamespace = config.eventNamespace || containerId;

        // Error state
        this.hasError = false;
        this.lastError = null;

        this._pendingOperations = new Set();
        this.eventHandlers = new Map();

        // Initialize managers
        try {
            this.initializeManagers();
        } catch (error) {
            this.handleFatalError(error);
            throw error;
        }

        // Bind methods
        this.handleResize = performance.debounce(this.handleResize.bind(this), 250);
        this.handleNodeClick = this.handleNodeClick.bind(this);
        
        // Add loading state
        this.container.classList.add('is-loading');
    }

    /**
     * Initializes all manager instances
     * @private
     */
    initializeManagers() {
        // State managers
        this.state = new StateManager(this);
        this.display = new DisplayManager(this);
        this.cache = new CacheManager(this);

        // Visualization managers
        this.viz = new VisualizationManager(this);
        this.nodes = new NodeManager(this);
        this.paths = new PathManager(this);
        this.outer = new OuterElementManager(this);
        this.zoom = new ZoomManager(this);

        // UI managers
        this.settings = new SettingsPanel(this);
        this.controls = new Controls(this);
    }

    /**
     * Initializes the visualization
     * @returns {Promise<void>}
     */
    async init() {
        console.log(`[CircularNav] Starting initialization for ${this.id}`);
        try {
            // Start initialization
            this.container.classList.add('is-initializing');
            
            await this.state.initialize();
            console.log(`[CircularNav] State initialized`);
            
            this.display.setup();
            console.log(`[CircularNav] Display setup complete`);
            
            await this.cache.init();
            console.log(`[CircularNav] Cache initialized`);
            
            await this.viz.create();
            console.log(`[CircularNav] Visualization created`);
            
            // Setup UI
            this.settings.create();
            console.log(`[CircularNav] Settings created`);
            this.controls.create();
            console.log(`[CircularNav] Controls created`);

            // Setup event listeners
            this.setupEventListeners();
            console.log(`[CircularNav] Event Listeners set up`);

            // Set initialized state
            await this.state.updateState({ isInitialized: true });
            console.log(`[CircularNav] State Updated`);
            
            // Remove loading states
            this.container.classList.remove('is-loading', 'is-initializing');
            console.log(`[CircularNav] Completing loading. Completing initialization. Emitting.`);
            
            // Emit initialization success event
            this.emitEvent('init:complete');
            
            console.log(`[CircularNav] Initialization complete for ${this.id}`);

        } catch (error) {
             console.error(`[CircularNav] Initialization failed:`, error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * Emits a namespaced event
     * @private
     */
    emitEvent(name, detail = {}) {
        const event = new CustomEvent(`${this.eventNamespace}:${name}`, {
            detail: { ...detail, instanceId: this.id },
            bubbles: true
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Sets up event listeners
     * @private
     */
    setupEventListeners() {
        // Window events - using namespaced handler to allow cleanup
        this._resizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);

        // Container events with namespacing
        this.container.addEventListener(`${this.eventNamespace}:node:click`, this.handleNodeClick);
        this.container.addEventListener(`${this.eventNamespace}:zoom:change`, this.handleZoomChange);
        
        // Error handling
        window.addEventListener('error', this.handleWindowError.bind(this));
        window.addEventListener('unhandledrejection', this.handlePromiseError.bind(this));

        // State change handlers with namespaced events
        this.state.on('selectionChange', this.handleSelectionChange.bind(this));
        this.state.on('dataChange', this.handleDataChange.bind(this));
    }

    /**
     * Removes event listeners
     * @private
     */
    removeEventListeners() {
        // Remove window events
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        // Remove container events
        this.container.removeEventListener(`${this.eventNamespace}:node:click`, this.handleNodeClick);
        this.container.removeEventListener(`${this.eventNamespace}:zoom:change`, this.handleZoomChange);
        
        // Remove error handling
        window.removeEventListener('error', this.handleWindowError);
        window.removeEventListener('unhandledrejection', this.handlePromiseError);

        // Remove state listeners
        this.state.removeAllListeners();
    }

    /**
     * Handles node click events
     * @param {Event} event - Custom event with node data
     * @private
     */
    handleNodeClick(event) {
        const node = event.detail.node;
        if (!node || this.state.isTransitioning) return;

        this.state.updateState({ 
            selectedNode: node,
            isTransitioning: true 
        });
    }

    /**
     * Handles resize events
     * @private
     */
    handleResize() {
        if (this.state.isDestroying) return;

        const dimensions = this.display.calculateDimensions();
        this.viz.update(null, dimensions);
    }

    /**
     * Error Handling Methods
     */
    handleError(error) {
        console.error(`[${this.id}] Error:`, error);
        this.lastError = error;
        this.hasError = true;

        // Add error state to container
        this.container.classList.add('has-error');
        
        // Emit error event
        this.emitEvent('error', { error });

        // Try to recover if possible
        this.attemptErrorRecovery(error);
    }

    handleFatalError(error) {
        console.error(`[${this.id}] Fatal Error:`, error);
        this.lastError = error;
        this.hasError = true;

        // Add fatal error state
        this.container.classList.add('has-fatal-error');
        
        // Emit fatal error event
        this.emitEvent('error:fatal', { error });
        
        // Cleanup
        this.destroy().catch(cleanupError => {
            console.error(`[${this.id}] Cleanup error:`, cleanupError);
        });
    }

    handleWindowError(event) {
        // Only handle errors from our container
        if (event.target && this.container.contains(event.target)) {
            event.preventDefault();
            this.handleError(event.error || new Error(event.message));
        }
    }

    handlePromiseError(event) {
        // Check if the promise error is from our code
        if (event.reason?.instanceId === this.id) {
            event.preventDefault();
            this.handleError(event.reason.error || event.reason);
        }
    }

    attemptErrorRecovery(error) {
        // Implement recovery strategies based on error type
        if (error.name === 'NetworkError') {
            // Retry data fetching
            setTimeout(() => this.retryFailedOperation(), 1000);
        } else if (error.name === 'RenderError') {
            // Try to re-render
            this.viz.update(null, this.display.calculateDimensions());
        }
    }

    /**
     * Updates the visualization
     * @param {Object} [data] - New data
     * @param {Object} [config] - New config
     * @returns {Promise<void>}
     */
    async update(data = null, config = null) {
        try {
            // Update state first
            await this.state.startUpdate();

            // Update config if provided
            if (config) {
                this.config = validateConfig({
                    ...this.config,
                    ...config
                }) ? {...this.config, ...config} : this.config;
            }

            // Update data if provided
            if (data) {
                await this.state.updateState({ data });
            }

            // Update visualization
            const dimensions = this.display.calculateDimensions();
            await this.viz.update(data, dimensions);

            // End update
            await this.state.endUpdate();

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Destroys the instance and cleans up
     * @returns {Promise<void>}
     */
    async destroy() {
        try {
            // Set destroying state
            await this.state.updateState({ isDestroying: true });
            this.container.classList.add('is-destroying');

            // Cancel all pending operations
            if (this._pendingOperations) {
                this._pendingOperations.forEach(operation => {
                    if (operation.cancel) operation.cancel();
                });
            }

            // Remove event listeners
            this.removeEventListeners();

            // Destroy managers in sequence
            await this.state.destroy();
            await this.cache.clear();
            this.display.destroy();
            this.viz.destroy();
            this.settings.destroy();
            this.controls.destroy();

            // Clean DOM
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }

            // Remove classes
            this.container.classList.remove(
                'is-loading',
                'is-initializing',
                'has-error',
                'has-fatal-error',
                'is-destroying'
            );

            // Clear all references
            this._pendingOperations = null;
            this.config = null;
            this.state = null;
            this.display = null;
            this.cache = null;
            this.viz = null;
            this.settings = null;
            this.controls = null;

            // Emit destroyed event
            this.emitEvent('destroyed');

        } catch (error) {
            console.error(`[${this.id}] Destroy error:`, error);
            throw error;
        }
    }
}