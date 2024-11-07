/**
 * Circular Navigation Entry Point
 * Handles initialization and instance management
 */
 
import * as d3 from '../lib/d3.min.js';
import { CircularNavManager } from './CircularNavManager.js';
import { DEFAULT_CONFIG } from './config.js';
import { PerformanceMonitor } from '../utils/performance.js';

export class CircularNavigation {
    static instances = new Map();
    static performanceMonitors = new Map();

    /**
     * Creates a new circular navigation instance
     */
    static createInstance(containerId, postType, config = {}) {
        console.log(`[CircularNav] Creating new instance for ${containerId}`);
        if (CircularNavigation.instances.has(containerId)) {
            console.warn(`[CircularNav] Instance ${containerId} already exists`);
            throw new Error(`Instance ${containerId} already exists`);
        }

        // Create performance monitor
        const performanceMonitor = new PerformanceMonitor();
        performanceMonitor.start();
        CircularNavigation.performanceMonitors.set(containerId, performanceMonitor);

        try {
            const instance = new CircularNavManager(containerId, postType, {
                ...DEFAULT_CONFIG,
                ...config,
                eventNamespace: containerId
            });

            CircularNavigation.instances.set(containerId, {
                instance,
                performanceMonitor,
                created: Date.now()
            });

            return instance;
        } catch (error) {
            performanceMonitor.stop();
            CircularNavigation.performanceMonitors.delete(containerId);
            CircularNavigation.handleError(containerId, error);
            throw error;
        }
    }

    /**
     * Gets an existing instance
     */
    static getInstance(containerId) {
        const instanceData = CircularNavigation.instances.get(containerId);
        return instanceData?.instance;
    }

    /**
     * Destroys an instance
     */
    static async destroyInstance(id) {
        const instanceData = CircularNavigation.instances.get(id);
        if (instanceData) {
            try {
                // Stop performance monitoring
                const monitor = CircularNavigation.performanceMonitors.get(id);
                if (monitor) {
                    const finalMetrics = monitor.getMetrics();
                    console.debug(`Instance ${id} final metrics:`, finalMetrics);
                    monitor.stop();
                    monitor.cleanup();
                    CircularNavigation.performanceMonitors.delete(id);
                }

                // Cleanup instance
                await instanceData.instance.destroy();
                CircularNavigation.instances.delete(id);

                return true;
            } catch (error) {
                console.error(`Error destroying instance ${id}:`, error);
                throw error;
            }
        }
        return false;
    }

    /**
     * Handles errors
     */
    static handleError(id, error) {
        console.error(`CircularNav Error (${id}):`, error);
        const container = document.getElementById(id);
        if (container) {
            container.classList.add('has-error');
            container.dispatchEvent(new CustomEvent('circular-nav:error', {
                detail: { error },
                bubbles: true
            }));
        }
    }

    /**
     * Gets performance metrics for an instance
     */
    static getInstanceMetrics(id) {
        const monitor = CircularNavigation.performanceMonitors.get(id);
        return monitor?.getMetrics() || null;
    }
}

// Initialize on document ready using modern approach
function initCircularNavigation() {
    console.log('[CircularNav] Starting global initialization');
    try {
        const containers = document.querySelectorAll('[data-circular-nav]');
        console.log(`[CircularNav] Found ${containers.length} containers`);
        
        containers.forEach(container => {
            try {
                if (!container.id) {
                    container.id = `circular-nav-${Math.random().toString(36).substr(2, 9)}`;
                }
                console.log(`[CircularNav] Initializing container ${container.id}`);
                
                const containerId = container.id;
                const postType = container.dataset.postType;
                const config = JSON.parse(container.dataset.config || '{}');
                
                console.log(`[CircularNav] Configuration for ${containerId}:`, {
                    postType,
                    config
                });

                CircularNavigation.createInstance(containerId, postType, config).init().catch(error => {
                    console.error('[CircularNav] Initialization failed:', error);
                });
            } catch (error) {
                console.error('[CircularNav] Container initialization failed:', error);
                console.error('Failed to initialize circular navigation:', error);
                container.classList.add('initialization-failed');
                container.dispatchEvent(new CustomEvent('circular-nav:init-error', {
                    detail: { error },
                    bubbles: true
                }));
            }
        });
    } catch (error) {
        console.error('Global initialization error:', error);
    }
}

// Modern way to handle DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCircularNavigation);
} else {
    initCircularNavigation();
}

// Cleanup on unload using modern approach
window.addEventListener('beforeunload', async () => {
    for (const [id] of CircularNavigation.instances) {
        try {
            await CircularNavigation.destroyInstance(id);
        } catch (error) {
            console.error(`Cleanup error for instance ${id}:`, error);
        }
    }
});

export default CircularNavigation;