/**
 * State Manager
 * Handles all state changes and transitions
 */

export class StateManager {
    constructor(parent) {
        this.parent = parent;
        this.eventNamespace = parent.eventNamespace;
        this.listeners = new Map();
        this.pendingTransitions = new Set();
        this.transitionTimeout = null;
        
        // Initialize state
        this.state = {
            isInitialized: false,
            isDestroying: false,
            isTransitioning: false,
            isUpdating: false,
            isError: false,
            error: null,
            data: null,
            selectedNode: null,
            previousNode: null,
            zoomLevel: 1,
            dimensions: null,
            contentLoaded: new Set(),
            lastUpdate: Date.now()
        };
    }

    /**
     * Initialize state
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.fetchInitialData();
            const success = await this.updateState({
                isInitialized: true,
                data: this.state.data,
                lastUpdate: Date.now()
            });

            if (!success) {
                throw new Error('Failed to initialize state');
            }

            this.emit('initialized', { success: true });
            return true;
        } catch (error) {
            this.state.error = error;
            this.state.isError = true;
            this.emit('initialized', { success: false, error });
            throw error;
        }
    }

    /**
     * Fetches initial data
     * @private
     * @returns {Promise<void>}
     */
    // In StateManager.js, modify fetchInitialData()
    async fetchInitialData() {
        try {
            console.log('Checking circularNavData:', window.circularNavData);
            
            if (!window.circularNavData) {
                throw new Error('WordPress data not initialized (circularNavData missing)');
            }

            if (!window.circularNavData.ajaxUrl) {
                throw new Error('WordPress AJAX URL not provided');
            }

            console.log('Fetching data with:', {
                ajaxUrl: window.circularNavData.ajaxUrl,
                postType: this.parent.postType,
                nonce: window.circularNavData.nonce
            });

            const response = await fetch(window.circularNavData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    action: 'fetch_hierarchical_posts',
                    post_type: this.parent.postType,
                    nonce: window.circularNavData.nonce
                })
            });

            const result = await response.json();
            console.log('Fetched data:', result);

            if (!result.success) {
                throw new Error('Data fetch failed: ' + JSON.stringify(result));
            }

            await this.updateState({ data: result.data });

        } catch (error) {
            console.error('Data fetch error:', error);
            this.parent.handleError(error);
            throw error;
        }
    }

    async validateAndProcessData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data structure');
        }

        if (!data.id || !data.name) {
            throw new Error('Missing required data fields');
        }

        // Additional validation as needed
        return true;
    }

    handleFetchError(error) {
        const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
        const isServerError = error.message.includes('HTTP error!');

        if (isNetworkError) {
            this.emit('fetch:error', { 
                type: 'network',
                error,
                retryable: true
            });
        } else if (isServerError) {
            this.emit('fetch:error', {
                type: 'server',
                error,
                retryable: error.message.includes('503') // Retry on service unavailable
            });
        } else {
            this.emit('fetch:error', {
                type: 'unknown',
                error,
                retryable: false
            });
        }
    }

    /**
     * Updates state and triggers events
     * @param {Object} newState - New state object
     * @returns {Promise<void>}
     */
    async updateState(newState) {
        // Don't update if destroying
        if (this.state.isDestroying) return false;

        try {
            // Start transition
            this.startTransition();

            const oldState = {...this.state};
            this.state = {...this.state, ...newState};

            // Handle specific state changes
            await this.handleStateChange(oldState, this.state);

            // Emit events for changed properties
            Object.keys(newState).forEach(key => {
                if (newState[key] !== oldState[key]) {
                    this.emit(`${key}Change`, {
                        oldValue: oldState[key],
                        newValue: newState[key],
                        timestamp: Date.now()
                    });
                }
            });

            // Update timestamp
            this.state.lastUpdate = Date.now();

            // End transition
            this.endTransition();
            return true;

        } catch (error) {
            // Handle transition error
            this.handleTransitionError(error);
            return false;
        }
    }

    startTransition() {
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
        }
        this.state.isTransitioning = true;
        this.emit('transition:start');
    }

    endTransition() {
        // Ensure minimum transition time for smooth animations
        const minTransitionTime = 100; // ms
        const elapsedTime = Date.now() - this.state.lastUpdate;

        if (elapsedTime < minTransitionTime) {
            this.transitionTimeout = setTimeout(() => {
                this.finalizeTransition();
            }, minTransitionTime - elapsedTime);
        } else {
            this.finalizeTransition();
        }
    }

    finalizeTransition() {
        this.state.isTransitioning = false;
        this.transitionTimeout = null;
        this.emit('transition:end');
    }

    handleTransitionError(error) {
        console.error('Transition error:', error);
        this.state.isTransitioning = false;
        this.state.error = error;
        this.state.isError = true;
        this.emit('transition:error', { error });
        throw error;
    }

    /**
     * Handles state changes
     * @private
     * @param {Object} oldState - Previous state
     * @param {Object} newState - New state
     */
    async handleStateChange(oldState, newState) {
        // Handle selection changes
        if (newState.selectedNode !== oldState.selectedNode) {
            if (oldState.selectedNode) {
                newState.previousNode = oldState.selectedNode;
            }
            await this.handleSelectionChange(newState.selectedNode, oldState.selectedNode);
        }

        // Handle data changes
        if (newState.data !== oldState.data) {
            await this.handleDataChange(newState.data);
        }

        // Handle transition state
        if (newState.isTransitioning !== oldState.isTransitioning) {
            this.handleTransitionChange(newState.isTransitioning);
        }

        // Handle error state
        if (newState.isError !== oldState.isError) {
            this.handleErrorChange(newState.error);
        }
    }

    /**
     * Handles node selection changes
     * @private
     * @param {Object} newNode - Newly selected node
     * @param {Object} oldNode - Previously selected node
     */
    async handleSelectionChange(newNode, oldNode) {
        // Start transition
        await this.updateState({ isTransitioning: true });

        try {
            // Preload content if needed
            if (newNode && !this.state.contentLoaded.has(newNode.id)) {
                await this.parent.cache.preload(newNode.id);
                this.state.contentLoaded.add(newNode.id);
            }

            // Update visualization
            await this.parent.viz.updateSelection(newNode, oldNode);

        } catch (error) {
            console.error('Selection change error:', error);
            this.parent.handleError(error);
        } finally {
            // End transition
            await this.updateState({ isTransitioning: false });
        }
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.listeners.clear();
        this.state = null;
    }

    /**
     * Update lifecycle methods
     */
    async startUpdate() {
        return this.updateState({ isUpdating: true });
    }

    async endUpdate() {
        return this.updateState({ isUpdating: false });
    }

    /**
     * Getters
     */
    getSelectedNode() {
        return this.state.selectedNode;
    }

    getPreviousNode() {
        return this.state.previousNode;
    }

    getData() {
        return this.state.data;
    }

    isTransitioning() {
        return this.state.isTransitioning;
    }
}