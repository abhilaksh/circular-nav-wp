/**
 * Display Manager
 * Handles dimensions, responsive behavior, and profile management
 */

import { performance } from '../utils/performance.js';
import { calculateTextWidth } from '../utils/calculations.js';

export class DisplayManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.currentProfile = null;
        this.lastDimensions = null;
        
        // Bind methods
        this.handleResize = performance.debounce(
            this.handleResize.bind(this),
            this.config.performance.debounceDelay
        );
    }

    /**
     * Sets up display manager
     */
    setup() {
        try {
            // Get initial profile and dimensions
            this.currentProfile = this.getActiveProfile();
            this.lastDimensions = this.calculateDimensions();

            // Setup resize observer
            this.setupResizeObserver();

            // Setup orientation change handling
            this.setupOrientationHandling();

            // Setup high-DPI display handling
            this.setupHighDPIHandling();

            // Add responsive classes
            this.updateResponsiveClasses();

            // Emit setup complete event
            this.parent.emitEvent('display:ready', {
                dimensions: this.lastDimensions,
                profile: this.currentProfile
            });

        } catch (error) {
            console.error('Display setup error:', error);
            throw error;
        }
    }

    /**
     * Sets up resize observer
     * @private
     */
    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(entries => {
            if (this.isResizing) return;

            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (this.hasSignificantChanges({ width, height })) {
                    this.handleResize();
                }
            }
        });

        this.resizeObserver.observe(this.parent.container);
    }

    /**
     * Sets up orientation change handling
     * @private
     */
    setupOrientationHandling() {
        if ('orientation' in screen) {
            this.orientationHandler = this.handleOrientationChange.bind(this);
            screen.orientation.addEventListener('change', this.orientationHandler);
        }
        window.addEventListener('orientationchange', this.handleOrientationChange);
    }

    /**
     * Sets up high-DPI display handling
     * @private
     */
    setupHighDPIHandling() {
        // Track pixel ratio changes
        this.mediaQueryList = window.matchMedia(`(resolution: ${this.pixelRatio}dppx)`);
        this.mediaQueryList.addListener(() => {
            this.pixelRatio = window.devicePixelRatio || 1;
            this.handleDisplayChange();
        });
    }

    /**
     * Updates responsive classes
     * @private
     */
    updateResponsiveClasses() {
        const { width } = this.parent.container.getBoundingClientRect();
        const { small, medium, large } = this.config.dimensions.breakpoints;

        this.parent.container.classList.remove(
            'size-small', 
            'size-medium', 
            'size-large'
        );

        if (width < small) {
            this.parent.container.classList.add('size-small');
        } else if (width < medium) {
            this.parent.container.classList.add('size-medium');
        } else {
            this.parent.container.classList.add('size-large');
        }

        // Add high-DPI class if needed
        this.parent.container.classList.toggle('high-dpi', this.pixelRatio > 1);
    }

    /**
     * Calculate current dimensions
     * @returns {Object} Dimension calculations
     */
    calculateDimensions() {
        const rect = this.parent.container.getBoundingClientRect();
        const profile = this.getActiveProfile();
        
        // Calculate base dimensions
        const dimensions = {
            width: this.calculateWidth(rect, profile),
            height: this.calculateHeight(rect, profile),
            radius: this.calculateRadius(rect, profile),
            text: this.calculateTextSizes(rect, profile),
            nodes: this.calculateNodeSizes(rect, profile),
            indicators: this.calculateIndicatorSizes(rect, profile)
        };

        // Store for comparison
        this.lastDimensions = dimensions;
        return dimensions;
    }

    /**
     * Get active profile based on current size
     * @returns {Object} Active profile
     */
    getActiveProfile() {
        const width = window.innerWidth;
        const { small, medium } = this.config.dimensions.breakpoints;

        if (width < small) return this.config.profiles.mobile;
        if (width < medium) return this.config.profiles.tablet;
        return this.config.profiles.desktop;
    }

    /**
     * Calculate container width
     * @private
     */
    calculateWidth(rect, profile) {
        const { min } = this.config.dimensions;
        const containerWidth = Math.max(rect.width, min.width);
        const maxWidth = window.innerWidth * 0.9;
        return Math.min(containerWidth, maxWidth);
    }

    /**
     * Calculate container height
     * @private
     */
    calculateHeight(rect, profile) {
        const { min } = this.config.dimensions;
        const containerHeight = Math.max(rect.height, min.height);
        const maxHeight = window.innerHeight * 0.7;
        return Math.min(containerHeight, maxHeight);
    }

    /**
     * Calculate visualization radius
     * @private
     */
    calculateRadius(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        const baseRadius = minDimension * 0.35; // 35% of smallest dimension
        
        return Math.max(
            this.config.node.central.minSize * 1.5,
            Math.min(baseRadius, rect.width * 0.4)
        );
    }

    /**
     * Calculate text sizes
     * @private
     */
    calculateTextSizes(rect, profile) {
        const width = rect.width;
        const { small, large } = this.config.dimensions.breakpoints;
        
        // Fluid typography calculation
        const calculateFluidSize = (minSize, maxSize) => {
            const slope = (maxSize - minSize) / (large - small);
            const size = minSize + (slope * (width - small));
            return Math.min(maxSize, Math.max(minSize, size));
        };

        return {
            central: calculateFluidSize(
                profile.textSizes.central,
                this.config.text.sizes.large.central
            ),
            primary: calculateFluidSize(
                profile.textSizes.primary,
                this.config.text.sizes.large.primary
            ),
            secondary: calculateFluidSize(
                profile.textSizes.secondary,
                this.config.text.sizes.large.secondary
            )
        };
    }

    /**
     * Calculate node sizes
     * @private
     */
    calculateNodeSizes(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        
        return {
            central: {
                width: Math.max(
                    profile.nodeSizes.central,
                    minDimension * 0.15
                ),
                height: Math.max(
                    profile.nodeSizes.central,
                    minDimension * 0.15
                )
            },
            primary: {
                width: Math.max(
                    profile.nodeSizes.primary.width,
                    minDimension * 0.1
                ),
                height: Math.max(
                    profile.nodeSizes.primary.height,
                    minDimension * 0.08
                )
            },
            secondary: {
                width: Math.max(
                    profile.nodeSizes.secondary.width,
                    minDimension * 0.08
                ),
                height: Math.max(
                    profile.nodeSizes.secondary.height,
                    minDimension * 0.06
                )
            }
        };
    }

    /**
     * Calculate indicator sizes
     * @private
     */
    calculateIndicatorSizes(rect, profile) {
        const minDimension = Math.min(rect.width, rect.height);
        
        return {
            inner: Math.max(
                this.config.indicator.inner.radius,
                minDimension * 0.01
            ),
            outer: Math.max(
                this.config.indicator.outer.radius,
                minDimension * 0.015
            )
        };
    }

    /**
     * Calculate text dimensions for specific content
     * @param {string} text - Text content
     * @param {string} type - Node type (central, primary, secondary)
     * @returns {Object} Text dimensions
     */
    calculateTextDimensions(text, type) {
        const fontSize = this.lastDimensions.text[type];
        return {
            width: calculateTextWidth(text, fontSize),
            height: fontSize * 1.2 // Approximate line height
        };
    }

    /**
     * Handles resize events
     * @private
     */
    handleResize() {
        if (this.parent.state.isDestroying) return;

        try {
            this.isResizing = true;
            this.parent.container.classList.add('is-resizing');

            // Get new dimensions
            const newDimensions = this.calculateDimensions();
            
            // Check for profile change
            const newProfile = this.getActiveProfile();
            const profileChanged = newProfile !== this.currentProfile;

            if (profileChanged) {
                this.handleProfileChange(newProfile);
            }

            // Update visualization if needed
            if (profileChanged || this.hasSignificantChanges(newDimensions)) {
                this.parent.viz.update(null, newDimensions);
            }

            // Update responsive classes
            this.updateResponsiveClasses();

        } catch (error) {
            console.error('Resize handling error:', error);
            this.parent.handleError(error);
        } finally {
            this.isResizing = false;
            this.parent.container.classList.remove('is-resizing');
        }
    }

    /**
     * Handles orientation changes
     * @private
     */
    handleOrientationChange() {
        if (this.parent.state.isDestroying) return;

        try {
            this.parent.container.classList.add('orientation-changing');
            
            // Recalculate dimensions with orientation consideration
            const dimensions = this.calculateDimensions();
            
            // Update visualization
            this.parent.viz.update(null, dimensions);
            
            // Update responsive classes
            this.updateResponsiveClasses();

        } catch (error) {
            console.error('Orientation change error:', error);
            this.parent.handleError(error);
        } finally {
            this.parent.container.classList.remove('orientation-changing');
        }
    }

    /**
     * Handles display changes (e.g., pixel ratio changes)
     * @private
     */
    handleDisplayChange() {
        if (this.parent.state.isDestroying) return;

        try {
            this.parent.container.classList.add('display-changing');
            
            // Update pixel ratio
            this.pixelRatio = window.devicePixelRatio || 1;
            
            // Recalculate dimensions
            const dimensions = this.calculateDimensions();
            
            // Update visualization
            this.parent.viz.update(null, dimensions);
            
            // Update responsive classes
            this.updateResponsiveClasses();

        } catch (error) {
            console.error('Display change error:', error);
            this.parent.handleError(error);
        } finally {
            this.parent.container.classList.remove('display-changing');
        }
    }

    /**
     * Handles profile changes
     * @private
     */
    handleProfileChange(newProfile) {
        this.currentProfile = newProfile;
        this.parent.emitEvent('profile:change', {
            profile: newProfile,
            dimensions: this.lastDimensions
        });
    }

    /**
     * Checks for significant dimension changes
     * @private
     */
    hasSignificantChanges(newDims) {
        if (!this.lastDimensions) return true;

        const threshold = 0.01; // 1% change threshold
        
        return (
            Math.abs(newDims.width - this.lastDimensions.width) > 
                this.lastDimensions.width * threshold ||
            Math.abs(newDims.height - this.lastDimensions.height) > 
                this.lastDimensions.height * threshold ||
            newDims.devicePixelRatio !== this.lastDimensions.devicePixelRatio ||
            newDims.orientation !== this.lastDimensions.orientation
        );
    }

    /**
     * Cleanup
     */
    destroy() {
        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove orientation handler
        if (this.orientationHandler && screen.orientation) {
            screen.orientation.removeEventListener('change', this.orientationHandler);
        }
        window.removeEventListener('orientationchange', this.handleOrientationChange);

        // Remove media query listener
        if (this.mediaQueryList) {
            this.mediaQueryList.removeListener();
            this.mediaQueryList = null;
        }

        // Clear references
        this.lastDimensions = null;
        this.currentProfile = null;
        this.isResizing = false;
    }
}