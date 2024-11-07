/**
 * Outer Element Manager
 * Handles creation, updating, and interaction of outer indicators and labels
 */
import * as d3 from '../lib/d3.min.js';

export class OuterElementManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.eventNamespace = parent.eventNamespace;
        
        // Core elements
        this.indicators = null;
        this.labels = null;
        
        // Element tracking
        this.indicatorElements = new Map();
        this.labelElements = new Map();
        
        // State tracking
        this.activeTransitions = new Map();
        this.isUpdating = false;
        this.hoveredElement = null;
    }

    /**
     * Creates outer elements
     */
    async create() {
        const data = this.parent.state.getData();
        if (!data) return;

        try {
            this.parent.container.classList.add('creating-outer-elements');

            // Get depth-2 nodes
            const outerNodes = data.descendants().filter(d => d.depth === 2);

            // Create container for outer elements
            const outerGroup = this.parent.viz.zoomContainer
                .append('g')
                .attr('class', 'outer-elements');

            // Create elements
            await Promise.all([
                this.createIndicators(outerGroup, outerNodes),
                this.createLabels(outerGroup, outerNodes)
            ]);

            // Setup interactions
            this.setupInteractions();

            return true;
        } catch (error) {
            console.error('Outer element creation error:', error);
            this.parent.emitEvent('outer:error', { error });
            throw error;
        } finally {
            this.parent.container.classList.remove('creating-outer-elements');
        }
    }

    /**
     * Creates indicator elements
     * @private
     */
    async createIndicators(container, nodes) {
        // Create indicator groups
        this.indicators = container.selectAll('g.indicator-group')
            .data(nodes, d => d.data.id)
            .join('g')
            .attr('class', 'indicator-group')
            .attr('transform', d => this.calculateIndicatorPosition(d));

        // Create inner indicators
        this.indicators.append('circle')
            .attr('class', 'outer-indicator')
            .attr('r', this.config.indicator.inner.radius)
            .attr('cx', 0)
            .attr('cy', 0);

        // Create indicator outlines
        this.indicators.append('circle')
            .attr('class', 'indicator-outline')
            .attr('r', this.config.indicator.outer.radius)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('fill', 'none')
            .style('opacity', 0);

        // Set initial styles and store references
        this.indicators.each((d, i, nodes) => {
            const indicator = d3.select(nodes[i]);
            this.indicatorElements.set(d.data.id, indicator);
            
            indicator.select('.outer-indicator')
                .style('fill', this.config.colors.indicator.default);
        });

        // Add ARIA attributes
        this.indicators
            .attr('role', 'button')
            .attr('aria-label', d => `${d.data.name} indicator`)
            .attr('tabindex', 0);
    }

    /**
     * Creates label elements
     * @private
     */
    async createLabels(container, nodes) {
        // Create label containers
        this.labels = container.selectAll('foreignObject.outer-text-container')
            .data(nodes, d => d.data.id)
            .join('foreignObject')
            .attr('class', 'outer-text-container');

        // Calculate and set dimensions for each label
        nodes.forEach((node, i) => {
            const labelData = this.calculateLabelLayout(node);
            const label = this.labels.filter(d => d === node);
            
            // Update container position and size
            label
                .attr('width', labelData.width)
                .attr('height', labelData.height)
                .attr('x', labelData.x)
                .attr('y', labelData.y)
                .html(d => this.createLabelContent(d, labelData));

            // Store reference
            this.labelElements.set(node.data.id, label);
        });

        // Add ARIA attributes
        this.labels
            .attr('role', 'button')
            .attr('aria-label', d => `${d.data.name} - Click to select`)
            .attr('tabindex', 0);
    }

    /**
     * Creates HTML content for labels
     * @private
     */
    createLabelContent(node, layout) {
        const fontSize = this.parent.display.lastDimensions.text.secondary;
        const dpi = window.devicePixelRatio || 1;
        
        if (layout.type === 'single') {
            return `
                <div class="outer-text" style="
                    width: ${layout.width}px;
                    height: ${layout.height}px;
                    font-size: ${fontSize * dpi}px;
                    line-height: ${fontSize * 1.2 * dpi}px;
                    transform: scale(${1/dpi});
                    transform-origin: center;
                ">
                    <div class="line-clamp-1">${node.data.name}</div>
                </div>
            `;
        }

        return `
            <div class="outer-text" style="
                width: ${layout.width}px;
                height: ${layout.height}px;
                font-size: ${fontSize * dpi}px;
                line-height: ${fontSize * 1.2 * dpi}px;
                transform: scale(${1/dpi});
                transform-origin: center;
            ">
                <div class="line-clamp-1">${layout.firstLine}</div>
                <div class="line-clamp-1">${layout.secondLine}</div>
            </div>
        `;
    }
/**
     * Calculates label layout
     * @private
     */
calculateLabelLayout(node) {
    const text = node.data.name;
    const words = text.split(' ');
    const totalLength = text.length;
    const wordCount = words.length;

    // Determine layout type
    let layout = {
        type: 'single',
        text: text,
        width: this.config.text.spacing.base,
        height: this.config.text.sizes.large.secondary * 1.5
    };

    if (wordCount > 1 && (
        totalLength > this.config.text.thresholds.longText ||
        wordCount > 2
    )) {
        // Calculate split point
        let midpoint = Math.ceil(wordCount / 2);
        const firstHalf = words.slice(0, midpoint).join(' ');
        const secondHalf = words.slice(midpoint).join(' ');
        
        // Adjust split if first half is much longer
        if (firstHalf.length > secondHalf.length * 1.5) {
            midpoint -= 1;
        }

        layout = {
            type: 'double',
            firstLine: words.slice(0, midpoint).join(' '),
            secondLine: words.slice(midpoint).join(' '),
            width: this.config.text.spacing.base,
            height: this.config.text.sizes.large.secondary * 2.5
        };
    }

    // Calculate position
    const angle = node.x;
    const radius = node.y + this.config.indicator.outer.radius;
    const position = this.calculateTextPosition(angle, radius, layout);

    return {
        ...layout,
        ...position
    };
}

/**
 * Calculates text position
 * @private
 */
calculateTextPosition(angle, radius, layout) {
    // Normalize angle
    let normalizedAngle = angle;
    while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
    while (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;
    
    // Calculate base position with dynamic spacing
    const sideProximity = Math.abs(Math.cos(angle));
    const dynamicSpacing = this.config.text.spacing.base + 
        (this.config.text.spacing.side * Math.pow(sideProximity, 1.5));
    
    const textRadius = radius + dynamicSpacing;
    let x = textRadius * Math.cos(angle);
    let y = textRadius * Math.sin(angle);
    
    // Center text
    x -= layout.width / 2;
    y -= layout.type === 'single' ? 
        layout.height / 4 : 
        layout.height / 2;
    
    return { x, y };
}

/**
 * Calculates indicator position
 * @private
 */
calculateIndicatorPosition(node) {
    const angle = node.x;
    const radius = node.y;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    return `translate(${x},${y})`;
}

/**
 * Sets up interactions
 * @private
 */
setupInteractions() {
    // Setup indicator interactions
    this.indicators
        .on('click', (event, d) => {
            event.stopPropagation();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        })
        .on('mouseover', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, true);
            }
        })
        .on('mouseout', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, false);
            }
        })
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleElementClick(d);
            }
            this.handleKeyboardNavigation(event, d);
        })
        .on('touchstart', event => event.preventDefault())
        .on('touchend', (event, d) => {
            event.preventDefault();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        });

    // Setup label interactions
    this.labels
        .on('click', (event, d) => {
            event.stopPropagation();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        })
        .on('mouseover', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, true);
            }
        })
        .on('mouseout', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, false);
            }
        })
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleElementClick(d);
            }
            this.handleKeyboardNavigation(event, d);
        });
}

/**
 * Handles keyboard navigation
 * @private
 */
handleKeyboardNavigation(event, node) {
    const nodes = this.indicators.data();
    const currentIndex = nodes.indexOf(node);
    let nextIndex;

    switch (event.key) {
        case 'ArrowRight':
            nextIndex = (currentIndex + 1) % nodes.length;
            break;
        case 'ArrowLeft':
            nextIndex = (currentIndex - 1 + nodes.length) % nodes.length;
            break;
        default:
            return;
    }

    event.preventDefault();
    const nextElement = this.indicatorElements.get(nodes[nextIndex].data.id);
    if (nextElement) {
        nextElement.node().focus();
    }
}

/**
 * Updates for selection changes
 */
async updateForSelection(selectedNode) {
    if (this.isUpdating) return;

    try {
        this.isUpdating = true;

        await Promise.all([
            this.updateIndicatorStates(selectedNode),
            this.updateLabelStates(selectedNode)
        ]);

        // Update animations
        this.updateAnimations(selectedNode);

    } catch (error) {
        console.error('Selection update error:', error);
        this.parent.emitEvent('outer:error', { error });
    } finally {
        this.isUpdating = false;
    }
}

/**
 * Updates indicator states
 * @private
 */
async updateIndicatorStates(selectedNode) {
    const transitions = this.indicators.nodes().map((node, i) => {
        return new Promise(resolve => {
            const indicator = d3.select(node);
            const data = this.indicators.data()[i];
            
            const isActive = this.isActiveIndicator(data, selectedNode);
            const shouldPulse = this.shouldPulse(data, selectedNode);

            const transition = indicator.select('.outer-indicator')
                .classed('active', isActive)
                .classed('pulse', shouldPulse)
                .transition()
                .duration(this.config.animation.duration)
                .style('fill', this.getIndicatorColor(data, selectedNode));

            this.parent.viz.trackTransition(
                transition,
                `indicator-${data.data.id}`
            );

            transition.on('end', resolve);
        });
    });

    await Promise.all(transitions);
}

/**
 * Updates label states
 * @private
 */
async updateLabelStates(selectedNode) {
    const transitions = this.labels.nodes().map((node, i) => {
        return new Promise(resolve => {
            const label = d3.select(node);
            const data = this.labels.data()[i];
            
            const isActive = this.isActiveLabel(data, selectedNode);
            const isFaded = this.isFadedLabel(data, selectedNode);

            const transition = label
                .classed('active', isActive)
                .classed('faded', isFaded)
                .transition()
                .duration(this.config.animation.duration)
                .style('opacity', this.getLabelOpacity(data, selectedNode));

            this.parent.viz.trackTransition(
                transition,
                `label-${data.data.id}`
            );

            transition.on('end', resolve);
        });
    });

    await Promise.all(transitions);
}

/**
 * Updates animations
 * @private
 */
updateAnimations(selectedNode) {
    this.indicators.select('.outer-indicator')
        .filter(d => this.shouldPulse(d, selectedNode))
        .each((d, i, nodes) => {
            const indicator = d3.select(nodes[i]);
            this.startPulseAnimation(indicator);
        });
}

/**
 * State calculations
 */
isActiveIndicator(node, selectedNode) {
    if (!selectedNode) return false;
    return node === selectedNode || 
           (selectedNode.depth === 1 && node.parent === selectedNode);
}

shouldPulse(node, selectedNode) {
    return node === selectedNode && selectedNode.depth === 2;
}

isActiveLabel(node, selectedNode) {
    return this.isActiveIndicator(node, selectedNode);
}

isFadedLabel(node, selectedNode) {
    if (!selectedNode || selectedNode.depth === 0) return false;
    if (selectedNode.depth === 1) return node.parent !== selectedNode;
    return node !== selectedNode && node.parent !== selectedNode.parent;
}

/**
 * Style calculations
 */
getIndicatorColor(node, selectedNode) {
    if (this.isActiveIndicator(node, selectedNode)) {
        return this.config.colors.indicator.active;
    }
    return this.config.colors.indicator.default;
}

getLabelOpacity(node, selectedNode) {
    if (this.isFadedLabel(node, selectedNode)) return 0.5;
    return 1;
}

/**
 * Event handlers
 */
handleElementClick(node) {
    this.parent.emitEvent('node:click', {
        node,
        type: 'outer',
        timestamp: Date.now()
    });
}

handleElementHover(node, isEnter) {
    if (this.parent.state.isTransitioning) return;

    // Update hover tracking
    this.hoveredElement = isEnter ? node : null;

    // Handle indicator hover
    const indicator = this.indicatorElements.get(node.data.id);
    if (indicator) {
        indicator.select('.outer-indicator')
            .transition()
            .duration(200)
            .attr('r', isEnter ? 
                this.config.indicator.inner.radius * 1.2 : 
                this.config.indicator.inner.radius
            );
    }

    // Handle label hover
    const label = this.labelElements.get(node.data.id);
    if (label) {
        label.transition()
            .duration(200)
            .style('transform', `scale(${isEnter ? 1.1 : 1})`);
    }

    // Emit hover event
    this.parent.emitEvent('outer:hover', {
        node,
        isEnter,
        timestamp: Date.now()
    });
}

/**
 * Animation methods
 */
startPulseAnimation(indicator) {
    indicator
        .transition()
        .duration(1000)
        .attr('r', this.config.indicator.inner.radius * 
            this.config.indicator.inner.activeScale)
        .transition()
        .duration(1000)
        .attr('r', this.config.indicator.inner.radius)
        .on('end', () => {
            if (indicator.classed('pulse')) {
                this.startPulseAnimation(indicator);
            }
        });
}

/**
 * Updates with new data
 */
async update(data) {
    if (!data || this.isUpdating) return;

    try {
        this.isUpdating = true;
        this.parent.container.classList.add('updating-outer-elements');

        const outerNodes = data.descendants().filter(d => d.depth === 2);

        // Update indicators
        await this.updateIndicators(outerNodes);

        // Update labels
        await this.updateLabels(outerNodes);

        // Update selection state if needed
        const selectedNode = this.parent.state.getSelectedNode();
        if (selectedNode) {
            await this.updateForSelection(selectedNode);
        }

        return true;
    } catch (error) {
        console.error('Outer element update error:', error);
        this.parent.emitEvent('outer:error', { error });
        throw error;
    } finally {
        this.isUpdating = false;
        this.parent.container.classList.remove('updating-outer-elements');
    }
}

/**
 * Updates indicators with new data
 * @private
 */
async updateIndicators(nodes) {
    // Update data binding
    this.indicators = this.parent.viz.zoomContainer
        .select('g.outer-elements')
        .selectAll('g.indicator-group')
        .data(nodes, d => d.data.id);

    // Handle enter
    const enterIndicators = this.indicators.enter()
        .append('g')
        .attr('class', 'indicator-group')
        .attr('transform', d => this.calculateIndicatorPosition(d));

    // Create indicators for new elements
    enterIndicators.each((d, i, nodes) => {
        const indicator = d3.select(nodes[i]);
        this.createIndicator(indicator);
        this.indicatorElements.set(d.data.id, indicator);
    });

    // Handle exit
    this.indicators.exit()
        .transition()
        .duration(this.config.animation.duration / 2)
        .style('opacity', 0)
        .remove()
        .each(d => this.indicatorElements.delete(d.data.id));

    // Merge and update
    this.indicators = enterIndicators.merge(this.indicators);

    // Setup interactions for new indicators
    enterIndicators.each((d, i, nodes) => {
        this.setupIndicatorInteractions(d3.select(nodes[i]));
    });
}

/**
 * Creates indicator for a group
 * @private
 */
createIndicator(indicator) {
    // Create inner indicator
    indicator.append('circle')
        .attr('class', 'outer-indicator')
        .attr('r', this.config.indicator.inner.radius)
        .attr('cx', 0)
        .attr('cy', 0)
        .style('fill', this.config.colors.indicator.default);

    // Create indicator outline
    indicator.append('circle')
        .attr('class', 'indicator-outline')
        .attr('r', this.config.indicator.outer.radius)
        .attr('cx', 0)
        .attr('cy', 0)
        .style('fill', 'none')
        .style('opacity', 0);

    // Add ARIA attributes
    indicator
        .attr('role', 'button')
        .attr('aria-label', d => `${d.data.name} indicator`)
        .attr('tabindex', 0);
}

/**
 * Setup indicator interactions
 * @private
 */
setupIndicatorInteractions(indicator) {
    indicator
        .on('click', (event, d) => {
            event.stopPropagation();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        })
        .on('mouseover', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, true);
            }
        })
        .on('mouseout', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, false);
            }
        })
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleElementClick(d);
            }
            this.handleKeyboardNavigation(event, d);
        })
        .on('touchstart', event => event.preventDefault())
        .on('touchend', (event, d) => {
            event.preventDefault();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        });
}

/**
 * Setup label interactions
 * @private
 */
setupLabelInteractions(label) {
    label
        .on('click', (event, d) => {
            event.stopPropagation();
            if (!this.parent.state.isTransitioning) {
                this.handleElementClick(d);
            }
        })
        .on('mouseover', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, true);
            }
        })
        .on('mouseout', (event, d) => {
            if (!this.parent.state.isTransitioning) {
                this.handleElementHover(d, false);
            }
        })
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleElementClick(d);
            }
            this.handleKeyboardNavigation(event, d);
        });
}

/** 
 * Updates labels with new data 
 * @private 
 */ 
async updateLabels(nodes) {
    // Update data binding
    this.labels = this.parent.viz.zoomContainer
        .select('g.outer-elements')
        .selectAll('foreignObject.outer-text-container')
        .data(nodes, d => d.data.id);

    // Handle enter
    const enterLabels = this.labels.enter()
        .append('foreignObject')
        .attr('class', 'outer-text-container');

    // Create labels for new elements
    enterLabels.each((d, i, nodes) => {
        const label = d3.select(nodes[i]);
        const labelData = this.calculateLabelLayout(d);
        
        label
            .attr('width', labelData.width)
            .attr('height', labelData.height)
            .attr('x', labelData.x)
            .attr('y', labelData.y)
            .html(() => this.createLabelContent(d, labelData));

        this.labelElements.set(d.data.id, label);
    });

    // Handle exit
    this.labels.exit()
        .transition()
        .duration(this.config.animation.duration / 2)
        .style('opacity', 0)
        .remove()
        .each(d => this.labelElements.delete(d.data.id));

    // Merge and update
    this.labels = enterLabels.merge(this.labels);

    // Update existing labels
    this.labels.each((d, i, nodes) => {
        const label = d3.select(nodes[i]);
        const labelData = this.calculateLabelLayout(d);

        label.transition()
            .duration(this.config.animation.duration)
            .attr('width', labelData.width)
            .attr('height', labelData.height)
            .attr('x', labelData.x)
            .attr('y', labelData.y);
    });

    // Setup interactions for new labels
    enterLabels.each((d, i, nodes) => {
        const label = d3.select(nodes[i]);
        this.setupLabelInteractions(label);
    });
}



/**
     * Cleanup
     */
destroy() {
    try {
        // Cancel any active transitions
        this.activeTransitions.forEach(t => {
            if (t.selection) {
                t.selection.interrupt();
            }
        });
        this.activeTransitions.clear();

        // Stop any active animations
        if (this.pulseAnimations) {
            this.pulseAnimations.forEach(rafId => {
                cancelAnimationFrame(rafId);
            });
            this.pulseAnimations.clear();
        }

        // Remove elements
        if (this.indicators) {
            this.indicators.remove();
        }
        if (this.labels) {
            this.labels.remove();
        }

        // Clear element tracking
        this.indicatorElements.clear();
        this.labelElements.clear();

        // Clear state
        this.isUpdating = false;
        this.hoveredElement = null;

        // Remove any lingering event listeners
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
    } catch (error) {
        console.error('Outer element cleanup error:', error);
    } finally {
        // Ensure references are cleared
        this.indicators = null;
        this.labels = null;
    }
}

/**
 * Gets element by ID
 * @private
 */
getElementsById(id) {
    return {
        indicator: this.indicatorElements.get(id),
        label: this.labelElements.get(id)
    };
}

/**
 * Validates element existence
 * @private
 */
validateElements() {
    return this.indicators !== null && 
           this.labels !== null && 
           this.indicatorElements.size > 0 && 
           this.labelElements.size > 0;
}
}