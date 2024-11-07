/**
 * Path Manager
 * Handles creation, updating, and styling of all paths/links between nodes
 */
 
 import * as d3 from '../lib/d3.min.js';


export class PathManager {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.eventNamespace = parent.eventNamespace;
        this.links = null;
        this.activeTransitions = new Map();
        this.pathElements = new Map(); // Track path elements for reuse
        this.isUpdating = false;
    }

    /**
     * Creates initial paths
     */
    async create() {
        const data = this.parent.state.getData();
        if (!data) return;

        try {
            this.parent.container.classList.add('creating-paths');

            // Create links group
            const linksGroup = this.parent.viz.zoomContainer
                .append('g')
                .attr('class', 'links');

            // Create path elements
            this.links = linksGroup
                .selectAll('path.link')
                .data(data.links(), this.getLinkId)
                .join('path')
                .attr('class', d => `link depth-${d.source.depth}-${d.target.depth}`)
                .attr('d', d => this.generateLinkPath(d))
                .style('fill', 'none')
                .style('stroke', this.config.colors.path.default)
                .style('stroke-width', this.config.node.linkWidth)
                .style('opacity', d => this.getInitialOpacity(d));

            // Store references
            this.links.each((d, i, nodes) => {
                this.pathElements.set(this.getLinkId(d), d3.select(nodes[i]));
            });

            return true;
        } catch (error) {
            console.error('Path creation error:', error);
            this.parent.emitEvent('paths:error', { error });
            throw error;
        } finally {
            this.parent.container.classList.remove('creating-paths');
        }
    }

    /**
     * Generates unique link ID
     * @private
     */
    getLinkId(d) {
        return `${d.source.data.id}-${d.target.data.id}`;
    }

    /**
     * Generates SVG path
     * @private
     */
    generateLinkPath(d) {
        if (d.source.depth === 0) {
            // Straight line from center
            const start = [0, 0];
            const end = this.calculateEndPoint(d.target);
            return `M${start[0]},${start[1]}L${end[0]},${end[1]}`;
        } else {
            // Curved path between nodes
            const sourcePoint = this.calculateEndPoint(d.source);
            const targetPoint = this.calculateEndPoint(d.target);
            const midX = (sourcePoint[0] + targetPoint[0]) / 2;
            const midY = (sourcePoint[1] + targetPoint[1]) / 2;
            
            // Add curve based on depth
            return `M${sourcePoint[0]},${sourcePoint[1]}
                    Q${midX},${midY} ${targetPoint[0]},${targetPoint[1]}`;
        }
    }

    /**
     * Calculates endpoint coordinates
     * @private
     */
    calculateEndPoint(node) {
        const angle = node.x - Math.PI / 2;
        const radius = node.y;
        return [
            radius * Math.cos(angle),
            radius * Math.sin(angle)
        ];
    }

    /**
     * Gets initial path opacity
     * @private
     */
    getInitialOpacity(link) {
        if (link.source.depth === 0) return 1;
        if (link.source.depth === 1 && link.target.depth === 2) return 0;
        return 1;
    }

    /**
     * Updates path states
     */
    async updatePathStates(selectedNode) {
        if (this.isUpdating) return;

        try {
            this.isUpdating = true;

            const transitions = this.links.nodes().map((node, i) => {
                return new Promise(resolve => {
                    const path = d3.select(node);
                    const pathData = this.links.data()[i];

                    const transition = path
                        .transition()
                        .duration(this.config.animation.duration)
                        .style('stroke', () => this.getPathColor(pathData, selectedNode))
                        .style('stroke-width', () => this.getPathWidth(pathData, selectedNode))
                        .style('opacity', () => this.getPathOpacity(pathData, selectedNode))
                        .style('stroke-dasharray', () => 
                            this.isSiblingPath(pathData, selectedNode) ? '5,5' : null
                        );

                    // Track transition
                    const transitionId = `path-${this.getLinkId(pathData)}`;
                    this.parent.viz.trackTransition(transition, transitionId);

                    transition.on('end', resolve);
                });
            });

            await Promise.all(transitions);
        } catch (error) {
            console.error('Path state update error:', error);
            this.parent.emitEvent('paths:error', { error });
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Updates paths with new data
     */
    async update(data) {
        if (!data || this.isUpdating) return;

        try {
            this.isUpdating = true;
            this.parent.container.classList.add('updating-paths');

            // Update data binding
            this.links = this.parent.viz.zoomContainer
                .select('g.links')
                .selectAll('path.link')
                .data(data.links(), this.getLinkId);

            // Handle enter
            const enterPaths = this.links.enter()
                .append('path')
                .attr('class', d => `link depth-${d.source.depth}-${d.target.depth}`)
                .attr('d', d => this.generateLinkPath(d))
                .style('opacity', 0);

            // Handle exit
            this.links.exit()
                .transition()
                .duration(this.config.animation.duration / 2)
                .style('opacity', 0)
                .remove()
                .each(d => this.pathElements.delete(this.getLinkId(d)));

            // Merge and update all paths
            this.links = enterPaths.merge(this.links);

            // Animate new paths
            await Promise.all([
                // Fade in new paths
                enterPaths.transition()
                    .duration(this.config.animation.duration)
                    .style('opacity', d => this.getInitialOpacity(d)),

                // Update existing paths
                this.links.transition()
                    .duration(this.config.animation.duration)
                    .attr('d', d => this.generateLinkPath(d))
            ]);

            // Update path states if there's a selected node
            const selectedNode = this.parent.state.getSelectedNode();
            if (selectedNode) {
                await this.updatePathStates(selectedNode);
            }

            return true;
        } catch (error) {
            console.error('Path update error:', error);
            this.parent.emitEvent('paths:error', { error });
            throw error;
        } finally {
            this.isUpdating = false;
            this.parent.container.classList.remove('updating-paths');
        }
    }

    /**
     * Path state calculations
     */
    isActivePath(link, selectedNode) {
        if (!link || !selectedNode) return false;
        
        if (selectedNode.depth === 0) return true;
        
        if (selectedNode.depth === 1) {
            return (selectedNode.parent && link.source === selectedNode.parent && 
                    link.target === selectedNode) ||
                   (link.source === selectedNode);
        }
        
        if (selectedNode.depth === 2) {
            return (link.target === selectedNode) || 
                   (selectedNode.parent && link.source === selectedNode.parent) ||
                   (selectedNode.parent?.parent && 
                    link.source === selectedNode.parent.parent && 
                    link.target === selectedNode.parent);
        }
        
        return false;
    }

    isSiblingPath(link, selectedNode) {
        if (!link || !selectedNode) return false;
        
        if (selectedNode.depth === 1) {
            return (selectedNode.parent && 
                    link.source === selectedNode.parent && 
                    link.target !== selectedNode);
        }
        
        if (selectedNode.depth === 2) {
            return (selectedNode.parent && 
                    link.source === selectedNode.parent && 
                    link.target !== selectedNode) ||
                   (selectedNode.parent?.parent && 
                    link.source !== selectedNode.parent.parent && 
                    link.target.depth === 2 && 
                    link.target !== selectedNode);
        }
        
        return false;
    }

    /**
     * Style calculations
     */
    getPathColor(link, selectedNode) {
        if (this.isActivePath(link, selectedNode)) {
            return this.config.colors.path.active;
        }
        if (this.isSiblingPath(link, selectedNode)) {
            return this.config.colors.path.inactive;
        }
        return this.config.colors.path.default;
    }

    getPathWidth(link, selectedNode) {
        return this.isActivePath(link, selectedNode) ? 
            this.config.node.linkWidth * 1.5 : 
            this.config.node.linkWidth;
    }

    getPathOpacity(link, selectedNode) {
        if (link.source.depth === 1 && link.target.depth === 2) {
            if (selectedNode?.depth === 0) return 1;
            if (selectedNode?.depth === 1) {
                return link.source === selectedNode ? 1 : 0;
            }
            if (selectedNode?.depth === 2 && selectedNode.parent) {
                return link.source === selectedNode.parent ? 1 : 0;
            }
            return 0;
        }
        return 1;
    }

    /**
     * Cleanup
     */
    destroy() {
        // Cancel active transitions
        this.activeTransitions.forEach(t => {
            if (t.selection) {
                t.selection.interrupt();
            }
        });
        this.activeTransitions.clear();

        // Remove paths
        if (this.links) {
            this.links.remove();
        }

        // Clear element tracking
        this.pathElements.clear();
        
        // Clear references
        this.links = null;
        this.isUpdating = false;
    }
}