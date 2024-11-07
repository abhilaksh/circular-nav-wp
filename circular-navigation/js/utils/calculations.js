/**
 * Calculation Utilities
 * Handles mathematical calculations and data processing
 */

import * as d3 from 'circular-nav-d3';

/**
 * Processes hierarchical data for D3
 * @param {Object} data - Raw hierarchical data
 * @returns {d3.hierarchy} Processed D3 hierarchy
 */
export function processHierarchicalData(data) {
    const root = d3.hierarchy(data);
    
    // Calculate tree layout
    const tree = d3.tree()
        .size([2 * Math.PI, 1])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
    
    tree(root);

    // Process nodes at each depth
    processDepthNodes(root);

    return root;
}

/**
 * Processes nodes at different depths
 * @private
 */
function processDepthNodes(root) {
    // Process depth-2 nodes (outer circle)
    const depthTwoNodes = root.descendants().filter(d => d.depth === 2);
    if (depthTwoNodes.length > 0) {
        const angleStep = (2 * Math.PI) / depthTwoNodes.length;
        depthTwoNodes.forEach((node, i) => {
            node.x = i * angleStep;
        });
    }

    // Process depth-1 nodes (inner circle)
    const depthOneNodes = root.children || [];
    depthOneNodes.forEach(node => {
        if (node.children && node.children.length > 0) {
            // Position based on children's average angle
            const childAngles = node.children.map(child => child.x);
            const avgAngle = calculateAverageAngle(childAngles);
            node.x = avgAngle;
        }
    });
}

/**
 * Calculates average angle accounting for circular wrap
 * @private
 */
function calculateAverageAngle(angles) {
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    
    if (maxAngle - minAngle > Math.PI) {
        // Handle wrap-around case
        return (minAngle + maxAngle + 2 * Math.PI) / 2 % (2 * Math.PI);
    }
    return (minAngle + maxAngle) / 2;
}

/**
 * Projects coordinates from polar to cartesian
 * @param {number} angle - Angle in radians
 * @param {number} radius - Radius value
 * @returns {Array} [x, y] coordinates
 */
export function project(angle, radius) {
    return [
        radius * Math.cos(angle - Math.PI / 2),
        radius * Math.sin(angle - Math.PI / 2)
    ];
}

/**
 * Calculates text width based on font size
 * @param {string} text - Text to measure
 * @param {number} fontSize - Font size in pixels
 * @returns {number} Approximate text width
 */
export function calculateTextWidth(text, fontSize) {
    // Approximate width using canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
}

/**
 * Interpolates between two colors
 * @param {string} color1 - Starting color
 * @param {string} color2 - Ending color
 * @param {number} factor - Interpolation factor (0-1)
 * @returns {string} Interpolated color
 */
export function interpolateColor(color1, color2, factor) {
    const c1 = d3.color(color1);
    const c2 = d3.color(color2);
    return d3.interpolateRgb(c1, c2)(factor);
}

/**
 * Calculates optimal node spacing
 * @param {number} containerSize - Container dimension
 * @param {number} nodeCount - Number of nodes
 * @param {number} nodeSize - Size of each node
 * @returns {number} Optimal spacing
 */
export function calculateOptimalSpacing(containerSize, nodeCount, nodeSize) {
    const minSpacing = nodeSize * 0.5;
    const availableSpace = containerSize - (nodeSize * nodeCount);
    const optimalSpacing = availableSpace / (nodeCount + 1);
    return Math.max(minSpacing, optimalSpacing);
}

/**
 * Calculates text wrap points
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} fontSize - Font size in pixels
 * @returns {Array} Array of text lines
 */
export function calculateTextWrap(text, maxWidth, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const width = calculateTextWidth(currentLine + ' ' + words[i], fontSize);
        if (width <= maxWidth) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines;
}

/**
 * Calculates curve tension based on node distance
 * @param {Object} source - Source node
 * @param {Object} target - Target node
 * @returns {number} Curve tension value
 */
export function calculateCurveTension(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.min(0.8, Math.max(0.3, distance / 1000));
}

/**
 * Calculates optimal animation duration based on change magnitude
 * @param {number} changeMagnitude - Magnitude of the change
 * @param {Object} config - Animation configuration
 * @returns {number} Animation duration in milliseconds
 */
export function calculateAnimationDuration(changeMagnitude, config) {
    const { minDuration, maxDuration } = config.animation;
    const duration = minDuration + (changeMagnitude * (maxDuration - minDuration));
    return Math.min(maxDuration, Math.max(minDuration, duration));
}

/**
 * Calculates collision detection boundaries
 * @param {Object} node - Node object
 * @param {Object} dimensions - Current dimensions
 * @returns {Object} Boundary box
 */
export function calculateBoundaries(node, dimensions) {
    const [x, y] = project(node.x, node.y);
    const size = node.depth === 0 ? 
        dimensions.nodes.central.width : 
        dimensions.nodes[node.depth === 1 ? 'primary' : 'secondary'].width;
    
    return {
        left: x - size / 2,
        right: x + size / 2,
        top: y - size / 2,
        bottom: y + size / 2
    };
}

/**
 * Validates angles are within bounds
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
}