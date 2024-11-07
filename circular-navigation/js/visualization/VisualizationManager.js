/**
 * Visualization Manager
 * Handles D3-based visualization with enhanced performance and transitions
 */
import * as d3 from '../lib/d3.min.js';

export class VisualizationManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.container = parent.container;
        this.eventNamespace = parent.eventNamespace;
        
        // D3 selections
        this.svg = null;
        this.zoomContainer = null;
        
        // State tracking
        this.activeTransitions = new Map();
        this.renderQueue = new Set();
        this.isUpdating = false;
        this.currentRaf = null;

        // Element pools for reuse
        this.elementPools = {
            nodes: new Set(),
            paths: new Set(),
            indicators: new Set()
        };
    }

    /**
     * Creates initial visualization
     */
    async create() {
        try {
            this.createSVG();
            
            // Sequential rendering with RAF
            await this.queueRender(async () => {
                await Promise.all([
                    this.parent.nodes.create(),
                    this.parent.paths.create(),
                    this.parent.outer.create()
                ]);
            });

            // Setup zoom after render
            this.parent.zoom.init(this.svg, this.zoomContainer);
            
            return true;
        } catch (error) {
            this.handleRenderError(error);
            return false;
        }
    }

    /**
     * Creates base SVG structure
     * @private
     */
    createSVG() {
         console.log('Creating SVG with container:', this.container);
        // Cleanup existing
        if (this.svg) {
            console.log('Cleaning up existing SVG');
            this.svg.remove();
        }

        // Create new SVG with high-DPI support
        const dpi = window.devicePixelRatio || 1;
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', `${this.parent.id}-svg`)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('transform', `scale(${1/dpi})`)
            .style('transform-origin', '0 0');

        console.log('Selected SVG:', this.svg.node());
         
        // Add zoom container
        this.zoomContainer = this.svg
            .append('g')
            .attr('class', 'zoom-container');
            
        console.log('Created zoom container:', this.zoomContainer.node());

        // Add ARIA attributes
        this.svg
            .attr('role', 'img')
            .attr('aria-label', 'Circular navigation visualization');
    }

    /**
     * Updates visualization with transition management
     */
    async update(data = null, dimensions = null) {
        if (this.isUpdating) {
            this.cancelPendingUpdates();
        }

        try {
            this.isUpdating = true;
            
            // Process new data if provided
            if (data) {
                data = this.processData(data);
                await this.parent.state.updateState({ data });
            }

            // Update dimensions if provided
            if (dimensions) {
                this.updateViewBox(dimensions);
            }

            // Batch updates using RAF
            await this.queueRender(async () => {
                const updates = [
                    this.parent.nodes.update(data),
                    this.parent.paths.update(data),
                    this.parent.outer.update(data)
                ];
                await Promise.all(updates);
            });

            return true;
        } catch (error) {
            this.handleRenderError(error);
            return false;
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Queues render operations
     * @private
     */
    async queueRender(renderFn) {
        return new Promise((resolve, reject) => {
            this.currentRaf = requestAnimationFrame(async () => {
                try {
                    await renderFn();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    this.currentRaf = null;
                }
            });
        });
    }

    /**
     * Cancels pending updates
     * @private
     */
    cancelPendingUpdates() {
        // Cancel RAF
        if (this.currentRaf) {
            cancelAnimationFrame(this.currentRaf);
            this.currentRaf = null;
        }

        // Cancel transitions
        this.activeTransitions.forEach(transition => {
            if (transition.selection) {
                transition.selection.interrupt();
            }
        });
        this.activeTransitions.clear();
    }

    /**
     * Tracks D3 transitions
     */
    trackTransition(transition, id) {
        this.activeTransitions.set(id, transition);
        transition.on('end interrupt', () => {
            this.activeTransitions.delete(id);
        });
    }

    /**
     * Handles render errors
     * @private
     */
    handleRenderError(error) {
        console.error('Render error:', error);
        this.parent.emitEvent('visualization:error', { error });
        
        // Try to recover
        this.cancelPendingUpdates();
        this.cleanupBrokenElements();
    }

    /**
     * Cleans up broken elements
     * @private
     */
    cleanupBrokenElements() {
        // Remove incomplete elements
        this.svg.selectAll('.incomplete').remove();
        this.svg.selectAll('.errored').remove();
    }

    /**
     * Updates SVG viewBox
     * @private
     */
    updateViewBox(dimensions) {
        const { width, height } = dimensions;
        const dpi = window.devicePixelRatio || 1;
        
        this.svg
            .attr('viewBox', [
                -width * dpi / 2,
                -height * dpi / 2,
                width * dpi,
                height * dpi
            ])
            .style('transform', `scale(${1/dpi})`);
    }

    /**
     * Cleanup
     */
    destroy() {
        // Cancel pending operations
        this.cancelPendingUpdates();

        // Remove SVG
        if (this.svg) {
            this.svg.remove();
        }

        // Clear element pools
        Object.values(this.elementPools).forEach(pool => pool.clear());

        // Clear references
        this.svg = null;
        this.zoomContainer = null;
        this.activeTransitions.clear();
        this.renderQueue.clear();
    }
}