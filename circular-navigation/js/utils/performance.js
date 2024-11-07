/**
 * Performance Utilities
 */

/**
 * Debounces function calls
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            fn(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttles function calls
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * RAF-based throttle for animations
 * @param {Function} fn - Function to throttle
 * @returns {Function} RAF-throttled function
 */
export function rafThrottle(fn) {
    let rafId = null;
    return function executedFunction(...args) {
        if (rafId) return;
        
        rafId = requestAnimationFrame(() => {
            fn(...args);
            rafId = null;
        });
    };
}

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: [],
            memory: [],
            events: new Map(),
            marks: new Map()
        };

        this.isMonitoring = false;
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.observer = null;
    }

    /**
     * Starts performance monitoring
     */
    start() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        // Start FPS monitoring
        this.monitorFPS();

        // Start memory monitoring if available
        if (window.performance?.memory) {
            this.monitorMemory();
        }

        // Setup performance observer if available
        if (window.PerformanceObserver) {
            this.setupObserver();
        }
    }

    /**
     * Stops performance monitoring
     */
    stop() {
        this.isMonitoring = false;
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
    }

    /**
     * Monitors FPS
     * @private
     */
    monitorFPS() {
        const measureFPS = () => {
            if (!this.isMonitoring) return;

            this.frameCount++;
            const currentTime = Date.now();
            const elapsed = currentTime - this.lastFrameTime;

            if (elapsed >= 1000) {
                const fps = (this.frameCount * 1000) / elapsed;
                this.metrics.fps.push({
                    timestamp: currentTime,
                    value: Math.round(fps)
                });

                // Keep last 60 seconds of data
                if (this.metrics.fps.length > 60) {
                    this.metrics.fps.shift();
                }

                this.frameCount = 0;
                this.lastFrameTime = currentTime;
            }

            this.rafId = requestAnimationFrame(measureFPS);
        };

        measureFPS();
    }

    /**
     * Monitors memory usage if available
     * @private
     */
    monitorMemory() {
        const measureMemory = () => {
            if (!this.isMonitoring) return;

            const memory = window.performance.memory;
            this.metrics.memory.push({
                timestamp: Date.now(),
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize
            });

            // Keep last 60 records
            if (this.metrics.memory.length > 60) {
                this.metrics.memory.shift();
            }

            setTimeout(measureMemory, 1000);
        };

        measureMemory();
    }

    /**
     * Sets up performance observer
     * @private
     */
    setupObserver() {
        this.observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                switch (entry.entryType) {
                    case 'measure':
                        this.recordMeasure(entry);
                        break;
                    case 'event':
                        this.recordEvent(entry);
                        break;
                }
            }
        });

        try {
            this.observer.observe({
                entryTypes: ['measure', 'event']
            });
        } catch (e) {
            console.warn('Performance observer not supported:', e);
        }
    }

    /**
     * Records performance measure
     * @private
     */
    recordMeasure(entry) {
        const measurements = this.metrics.marks.get(entry.name) || [];
        measurements.push({
            timestamp: entry.startTime,
            duration: entry.duration
        });

        // Keep last 100 measurements per mark
        if (measurements.length > 100) {
            measurements.shift();
        }

        this.metrics.marks.set(entry.name, measurements);
    }

    /**
     * Records event timing
     * @private
     */
    recordEvent(entry) {
        const events = this.metrics.events.get(entry.name) || [];
        events.push({
            timestamp: entry.startTime,
            duration: entry.duration,
            type: entry.name
        });

        // Keep last 100 events per type
        if (events.length > 100) {
            events.shift();
        }

        this.metrics.events.set(entry.name, events);
    }

    /**
     * Gets current metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            fps: this.getAverageFPS(),
            memory: this.getMemoryUsage(),
            events: this.getEventMetrics(),
            marks: Object.fromEntries(this.metrics.marks)
        };
    }

    /**
     * Gets average FPS
     * @private
     */
    getAverageFPS() {
        if (this.metrics.fps.length === 0) return 0;
        const sum = this.metrics.fps.reduce((acc, curr) => acc + curr.value, 0);
        return Math.round(sum / this.metrics.fps.length);
    }

    /**
     * Gets memory usage
     * @private
     */
    getMemoryUsage() {
        if (this.metrics.memory.length === 0) return null;
        const latest = this.metrics.memory[this.metrics.memory.length - 1];
        return {
            used: latest.used,
            total: latest.total,
            percentage: (latest.used / latest.total) * 100
        };
    }

    /**
     * Gets event metrics
     * @private
     */
    getEventMetrics() {
        const metrics = {};
        this.metrics.events.forEach((events, type) => {
            const durations = events.map(e => e.duration);
            metrics[type] = {
                count: events.length,
                averageDuration: durations.reduce((a, b) => a + b, 0) / events.length,
                maxDuration: Math.max(...durations),
                minDuration: Math.min(...durations)
            };
        });
        return metrics;
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.stop();
        this.metrics = {
            fps: [],
            memory: [],
            events: new Map(),
            marks: new Map()
        };
    }
}

// Export performance utilities
export const performance = {
    debounce,
    throttle,
    rafThrottle,
    PerformanceMonitor
};