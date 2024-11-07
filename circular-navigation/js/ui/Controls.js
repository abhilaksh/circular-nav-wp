/**
 * Controls
 * Handles zoom controls and other UI elements
 */

import { createElement } from '../utils/dom.js';

export class Controls {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.container = null;
        this.currentZoom = 1;
        this.isZooming = false;

        // Bind methods
        this.handleZoomIn = this.handleZoomIn.bind(this);
        this.handleZoomOut = this.handleZoomOut.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
    }

    /**
     * Creates control elements
     */
    create() {
        // Create container
        this.container = createElement('div', {
            className: 'circular-nav-controls',
            dataset: { id: `${this.parent.id}-controls` }
        });

        // Add zoom controls
        this.createZoomControls();

        // Optional: Add other controls (fullscreen, reset, etc.)
        this.createAdditionalControls();

        // Add to parent container
        this.parent.container.appendChild(this.container);

        // Setup keyboard controls
        this.setupKeyboardControls();
    }

    /**
     * Creates zoom control buttons
     * @private
     */
    createZoomControls() {
        const zoomGroup = createElement('div', {
            className: 'control-group zoom-controls'
        });

        // Zoom in button
        const zoomInBtn = createElement('button', {
            className: 'control-btn zoom-in',
            title: 'Zoom In',
            'aria-label': 'Zoom In'
        });
        zoomInBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
        `;
        zoomInBtn.addEventListener('click', this.handleZoomIn);

        // Zoom out button
        const zoomOutBtn = createElement('button', {
            className: 'control-btn zoom-out',
            title: 'Zoom Out',
            'aria-label': 'Zoom Out'
        });
        zoomOutBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M19 13H5v-2h14v2z"/>
            </svg>
        `;
        zoomOutBtn.addEventListener('click', this.handleZoomOut);

        // Reset zoom button
        const resetBtn = createElement('button', {
            className: 'control-btn zoom-reset',
            title: 'Reset Zoom',
            'aria-label': 'Reset Zoom'
        });
        resetBtn.innerHTML = '1x';
        resetBtn.addEventListener('click', this.handleReset);

        // Add zoom level indicator
        this.zoomIndicator = createElement('div', {
            className: 'zoom-indicator',
            textContent: '100%'
        });

        // Assemble zoom controls
        zoomGroup.appendChild(zoomOutBtn);
        zoomGroup.appendChild(resetBtn);
        zoomGroup.appendChild(zoomInBtn);
        zoomGroup.appendChild(this.zoomIndicator);

        this.container.appendChild(zoomGroup);
    }

    /**
     * Creates additional control buttons
     * @private
     */
    createAdditionalControls() {
        const additionalGroup = createElement('div', {
            className: 'control-group additional-controls'
        });

        // Center view button
        const centerBtn = createElement('button', {
            className: 'control-btn center-view',
            title: 'Center View',
            'aria-label': 'Center View'
        });
        centerBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
        centerBtn.addEventListener('click', () => this.handleCenter());

        additionalGroup.appendChild(centerBtn);
        this.container.appendChild(additionalGroup);
    }

    /**
     * Sets up keyboard controls
     * @private
     */
    setupKeyboardControls() {
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyboard);

        // Add focus management
        this.container.querySelectorAll('button').forEach(button => {
            button.addEventListener('focus', () => {
                this.currentFocused = button;
            });
        });
    }

    /**
     * Handles keyboard controls
     * @private
     */
    handleKeyboard(event) {
        // Only handle events when visualization is focused
        if (!this.parent.container.contains(document.activeElement)) return;

        switch (event.key) {
            case '+':
            case '=':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.handleZoomIn();
                }
                break;

            case '-':
            case '_':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.handleZoomOut();
                }
                break;

            case '0':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.handleReset();
                }
                break;
        }
    }

    /**
     * Handles zoom in
     * @private
     */
    handleZoomIn() {
        if (this.isZooming) return;
        
        const newZoom = Math.min(
            this.currentZoom * this.config.zoom.step,
            this.config.zoom.max
        );
        
        this.updateZoom(newZoom);
    }

    /**
     * Handles zoom out
     * @private
     */
    handleZoomOut() {
        if (this.isZooming) return;
        
        const newZoom = Math.max(
            this.currentZoom / this.config.zoom.step,
            this.config.zoom.min
        );
        
        this.updateZoom(newZoom);
    }

    /**
     * Handles zoom reset
     * @private
     */
    handleReset() {
        if (this.isZooming) return;
        this.updateZoom(1);
    }

    /**
     * Handles center view
     * @private
     */
    handleCenter() {
        const event = new CustomEvent('view:center', {
            bubbles: true
        });
        this.parent.container.dispatchEvent(event);
    }

    /**
     * Updates zoom level
     * @private
     */
    async updateZoom(newZoom) {
        if (newZoom === this.currentZoom) return;

        this.isZooming = true;

        try {
            // Update zoom state
            this.currentZoom = newZoom;

            // Update indicator
            this.updateZoomIndicator();

            // Dispatch zoom event
            const event = new CustomEvent('zoom:change', {
                detail: { zoom: newZoom },
                bubbles: true
            });
            this.parent.container.dispatchEvent(event);

            // Wait for animation
            await new Promise(resolve => 
                setTimeout(resolve, this.config.animation.duration)
            );

        } finally {
            this.isZooming = false;
        }
    }

    /**
     * Updates zoom indicator
     * @private
     */
    updateZoomIndicator() {
        if (this.zoomIndicator) {
            this.zoomIndicator.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
    }

    /**
     * Gets current zoom level
     */
    getCurrentZoom() {
        return this.currentZoom;
    }

    /**
     * Cleanup
     */
    destroy() {
        // Remove keyboard listener
        document.removeEventListener('keydown', this.handleKeyboard);

        // Remove container
        if (this.container) {
            this.container.remove();
        }

        // Clear state
        this.container = null;
        this.currentZoom = 1;
        this.isZooming = false;
    }
}