/**
 * Zoom Manager
 * Handles zoom and pan behavior for the visualization
 */

export class ZoomManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        
        // State
        this.currentScale = 1;
        this.currentTranslate = [0, 0];
        this.isZooming = false;

        // D3 zoom behavior
        this.zoom = null;

        // Bind methods
        this.handleZoom = this.handleZoom.bind(this);
        this.handleZoomStart = this.handleZoomStart.bind(this);
        this.handleZoomEnd = this.handleZoomEnd.bind(this);
    }

    /**
     * Initializes zoom behavior
     * @param {d3.Selection} svg - Main SVG element
     * @param {d3.Selection} container - Zoom container element
     */
    init(svg, container) {
        // Create D3 zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([this.config.zoom.min, this.config.zoom.max])
            .on('start', this.handleZoomStart)
            .on('zoom', this.handleZoom)
            .on('end', this.handleZoomEnd);

        // Apply zoom behavior to SVG
        svg.call(this.zoom);

        // Store container reference
        this.container = container;

        // Listen for custom zoom events
        this.parent.container.addEventListener('zoom:change', 
            this.handleZoomEvent.bind(this));
        this.parent.container.addEventListener('view:center', 
            this.centerView.bind(this));
    }

    /**
     * Handles zoom start
     * @private
     */
    handleZoomStart() {
        this.isZooming = true;
        this.parent.container.classList.add('is-zooming');
    }

    /**
     * Handles zoom changes
     * @private
     */
    handleZoom(event) {
        if (!this.container) return;

        // Get new transform
        const transform = event.transform;

        // Update container transform
        this.container.attr('transform', transform);

        // Update state
        this.currentScale = transform.k;
        this.currentTranslate = [transform.x, transform.y];

        // Emit zoom update event
        const detail = {
            scale: transform.k,
            translate: [transform.x, transform.y],
            source: 'interaction'
        };

        const zoomEvent = new CustomEvent('zoom:update', { detail });
        this.parent.container.dispatchEvent(zoomEvent);
    }

    /**
     * Handles zoom end
     * @private
     */
    handleZoomEnd() {
        this.isZooming = false;
        this.parent.container.classList.remove('is-zooming');
    }

    /**
     * Handles custom zoom events
     * @private
     */
    handleZoomEvent(event) {
        const { zoom } = event.detail;
        
        // Calculate center point
        const bounds = this.parent.container.getBoundingClientRect();
        const center = [bounds.width / 2, bounds.height / 2];

        // Transition to new zoom level
        d3.select(this.parent.container)
            .select('svg')
            .transition()
            .duration(this.config.animation.duration)
            .call(
                this.zoom.transform,
                d3.zoomIdentity
                    .translate(center[0], center[1])
                    .scale(zoom)
                    .translate(-center[0], -center[1])
            );
    }

    /**
     * Zooms to specific point
     * @param {Array} point - Target point [x, y]
     * @param {number} scale - Target scale
     * @param {number} [duration] - Transition duration
     */
    zoomToPoint(point, scale, duration = this.config.animation.duration) {
        if (!this.zoom || !this.container) return;

        d3.select(this.parent.container)
            .select('svg')
            .transition()
            .duration(duration)
            .call(
                this.zoom.transform,
                d3.zoomIdentity
                    .translate(point[0], point[1])
                    .scale(scale)
                    .translate(-point[0], -point[1])
            );
    }

    /**
     * Zooms to fit specific nodes
     * @param {Array} nodes - Array of nodes to fit
     * @param {number} [padding] - Padding around nodes
     */
    zoomToFit(nodes, padding = 50) {
        if (!nodes.length || !this.container) return;

        // Calculate bounds
        let bounds = {
            left: Infinity,
            right: -Infinity,
            top: Infinity,
            bottom: -Infinity
        };

        nodes.forEach(node => {
            const box = this.parent.nodes.getNodeBounds(node);
            bounds.left = Math.min(bounds.left, box.left);
            bounds.right = Math.max(bounds.right, box.right);
            bounds.top = Math.min(bounds.top, box.top);
            bounds.bottom = Math.max(bounds.bottom, box.bottom);
        });

        // Add padding
        bounds.left -= padding;
        bounds.right += padding;
        bounds.top -= padding;
        bounds.bottom += padding;

        // Calculate required scale
        const containerBounds = this.parent.container.getBoundingClientRect();
        const scaleX = containerBounds.width / (bounds.right - bounds.left);
        const scaleY = containerBounds.height / (bounds.bottom - bounds.top);
        const scale = Math.min(
            scaleX, 
            scaleY, 
            this.config.zoom.max
        );

        // Calculate center point
        const cx = (bounds.left + bounds.right) / 2;
        const cy = (bounds.top + bounds.bottom) / 2;

        // Zoom to bounds
        this.zoomToPoint([cx, cy], scale);
    }

    /**
     * Zooms to specific node
     * @param {Object} node - Target node
     */
    zoomToNode(node) {
        if (!node || !this.container) return;

        // Get node position
        const [x, y] = this.parent.nodes.getNodePosition(node);

        // Calculate appropriate scale based on node depth
        const scale = this.calculateNodeZoomScale(node);

        // Zoom to node
        this.zoomToPoint([x, y], scale);
    }

    /**
     * Calculates appropriate zoom scale for node
     * @private
     */
    calculateNodeZoomScale(node) {
        // Scale based on node depth
        const baseScale = Math.max(
            1,
            1 + (node.depth * 0.5)
        );

        // Constrain to zoom limits
        return Math.min(
            Math.max(baseScale, this.config.zoom.min),
            this.config.zoom.max
        );
    }

    /**
     * Centers the view
     */
    centerView() {
        if (!this.container) return;

        d3.select(this.parent.container)
            .select('svg')
            .transition()
            .duration(this.config.animation.duration)
            .call(
                this.zoom.transform,
                d3.zoomIdentity
            );
    }

    /**
     * Gets current transform
     */
    getCurrentTransform() {
        return {
            scale: this.currentScale,
            translate: this.currentTranslate
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.container) {
            // Remove zoom behavior
            d3.select(this.parent.container)
                .select('svg')
                .on('.zoom', null);
        }

        // Remove event listeners
        this.parent.container.removeEventListener('zoom:change', 
            this.handleZoomEvent);
        this.parent.container.removeEventListener('view:center', 
            this.centerView);

        // Clear references
        this.zoom = null;
        this.container = null;
    }
}