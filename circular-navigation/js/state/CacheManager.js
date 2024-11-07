/**
 * Cache Manager
 * Handles content caching, preloading, and memory management
 */

export class CacheManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        
        // Initialize cache storage
        this.cache = new Map();
        this.preloadQueue = new Set();
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0,
            lastCleanup: Date.now()
        };

        // Loading state
        this.isLoading = false;
        this.loadingPromises = new Map();
    }

    /**
     * Initializes cache system
     */
    async init() {
        // Clear any existing cache
        this.clear();
        
        // Preload root content
        const data = this.parent.state.getData();
        if (data?.id) {
            await this.preloadContent(data.id);
        }
    }

    /**
     * Gets content from cache or fetches it
     * @param {string} id - Content ID
     * @returns {Promise<Object>} Content data
     */
    async get(id) {
        // Check if content is already being loaded
        if (this.loadingPromises.has(id)) {
            return this.loadingPromises.get(id);
        }

        // Check cache first
        if (this.cache.has(id)) {
            this.stats.hits++;
            const cached = this.cache.get(id);
            cached.lastAccessed = Date.now();
            return cached.content;
        }

        // Cache miss - fetch content
        this.stats.misses++;
        const promise = this.fetchContent(id);
        this.loadingPromises.set(id, promise);

        try {
            const content = await promise;
            this.set(id, content);
            return content;
        } finally {
            this.loadingPromises.delete(id);
        }
    }

    /**
     * Sets content in cache
     * @param {string} id - Content ID
     * @param {Object} content - Content to cache
     */
    set(id, content) {
        // Add to cache with metadata
        this.cache.set(id, {
            content,
            added: Date.now(),
            lastAccessed: Date.now(),
            size: this.estimateSize(content)
        });

        // Update stats
        this.stats.size = this.cache.size;

        // Check if cleanup needed
        if (this.shouldCleanup()) {
            this.cleanup();
        }
    }

    /**
     * Preloads content
     * @param {string|Array} ids - Content ID(s) to preload
     */
    async preloadContent(ids) {
        // Convert single ID to array
        const idArray = Array.isArray(ids) ? ids : [ids];
        
        // Add to preload queue
        idArray.forEach(id => {
            if (!this.cache.has(id) && !this.preloadQueue.has(id)) {
                this.preloadQueue.add(id);
            }
        });

        // Start preloading if not already loading
        if (!this.isLoading) {
            this.processPreloadQueue();
        }
    }

    /**
     * Processes preload queue
     * @private
     */
    async processPreloadQueue() {
        if (this.isLoading || this.preloadQueue.size === 0) return;

        this.isLoading = true;

        try {
            // Get next batch from queue
            const batch = this.getBatch();

            // Load in parallel with delay between batches
            while (batch.size > 0) {
                const promises = Array.from(batch).map(async id => {
                    try {
                        const content = await this.fetchContent(id);
                        this.set(id, content);
                    } catch (error) {
                        console.warn(`Failed to preload content ${id}:`, error);
                    } finally {
                        this.preloadQueue.delete(id);
                    }
                });

                await Promise.all(promises);

                // Delay between batches
                if (this.preloadQueue.size > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.config.cache.preloadDelay)
                    );
                }
            }

        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Gets next batch from preload queue
     * @private
     */
    getBatch() {
        const batchSize = this.config.performance.batchSize;
        const batch = new Set();
        let count = 0;

        for (const id of this.preloadQueue) {
            if (count >= batchSize) break;
            batch.add(id);
            count++;
        }

        return batch;
    }

    /**
     * Fetches content from server
     * @private
     */
    async fetchContent(id) {
        try {
            const response = await fetch(
                `/wp-json/my-custom-route/v1/elementor-content/${id}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.processContent(data);

        } catch (error) {
            console.error(`Failed to fetch content ${id}:`, error);
            throw error;
        }
    }

    /**
     * Processes fetched content
     * @private
     */
    processContent(data) {
        // Create a temporary container
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = data.content;

        // Process styles
        const styles = Array.from(tempContainer.querySelectorAll('style'))
            .map(style => style.outerHTML)
            .join('');

        // Get main content
        const elementorContent = tempContainer.querySelector('.elementor')?.outerHTML 
            || data.content;

        return {
            html: styles + elementorContent,
            version: data.version,
            processed: Date.now()
        };
    }

    /**
     * Estimates content size
     * @private
     */
    estimateSize(content) {
        return new Blob([JSON.stringify(content)]).size;
    }

    /**
     * Checks if cleanup needed
     * @private
     */
    shouldCleanup() {
        const timeSinceCleanup = Date.now() - this.stats.lastCleanup;
        return this.cache.size > this.config.cache.maxSize ||
               timeSinceCleanup > 300000; // 5 minutes
    }

    /**
     * Cleans up old cache entries
     * @private
     */
    cleanup() {
        if (this.cache.size <= this.config.cache.maxSize) return;

        // Sort entries by last accessed time
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

        // Remove oldest entries until under max size
        const removeCount = this.cache.size - this.config.cache.maxSize;
        entries.slice(0, removeCount).forEach(([id]) => {
            this.cache.delete(id);
        });

        // Update stats
        this.stats.size = this.cache.size;
        this.stats.lastCleanup = Date.now();
    }

    /**
     * Gets cache stats
     */
    getStats() {
        return {
            ...this.stats,
            preloadQueueSize: this.preloadQueue.size,
            isLoading: this.isLoading
        };
    }

    /**
     * Clears all cache
     */
    clear() {
        this.cache.clear();
        this.preloadQueue.clear();
        this.loadingPromises.clear();
        this.isLoading = false;
        
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0,
            lastCleanup: Date.now()
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.clear();
    }
}