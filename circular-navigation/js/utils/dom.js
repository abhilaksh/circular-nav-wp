/**
 * DOM Utilities
 * Handles DOM manipulation and style management
 */

/**
 * Creates a DOM element with attributes and styles
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Object} styles - CSS styles
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, styles = {}) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Set styles
    Object.entries(styles).forEach(([key, value]) => {
        element.style[key] = value;
    });
    
    return element;
}

/**
 * Gets CSS variable value
 * @param {string} variable - CSS variable name
 * @param {HTMLElement} element - Context element
 * @returns {string} CSS variable value
 */
export function getCSSVariable(variable, element = document.documentElement) {
    return getComputedStyle(element)
        .getPropertyValue(variable)
        .trim();
}

/**
 * Sets CSS variables on an element
 * @param {HTMLElement} element - Target element
 * @param {Object} variables - CSS variables object
 */
export function setCSSVariables(element, variables) {
    Object.entries(variables).forEach(([key, value]) => {
        element.style.setProperty(key, value);
    });
}

/**
 * Safely removes an element
 * @param {HTMLElement} element - Element to remove
 */
export function removeElement(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Adds multiple class names to an element
 * @param {HTMLElement} element - Target element
 * @param {Array} classes - Array of class names
 */
export function addClasses(element, classes) {
    classes.forEach(className => {
        if (className) {
            element.classList.add(className);
        }
    });
}

/**
 * Removes multiple class names from an element
 * @param {HTMLElement} element - Target element
 * @param {Array} classes - Array of class names
 */
export function removeClasses(element, classes) {
    classes.forEach(className => {
        if (className) {
            element.classList.remove(className);
        }
    });
}

/**
 * Adds styles while tracking changes for reversion
 * @param {HTMLElement} element - Target element
 * @param {Object} styles - Styles to apply
 * @returns {Object} Original styles
 */
export function addTemporaryStyles(element, styles) {
    const original = {};
    
    Object.entries(styles).forEach(([key, value]) => {
        original[key] = element.style[key];
        element.style[key] = value;
    });
    
    return original;
}

/**
 * Reverts temporary styles
 * @param {HTMLElement} element - Target element
 * @param {Object} originalStyles - Original styles to restore
 */
export function revertStyles(element, originalStyles) {
    Object.entries(originalStyles).forEach(([key, value]) => {
        element.style[key] = value;
    });
}

/**
 * Creates a div with html content
 * @param {string} html - HTML content
 * @returns {HTMLElement} Created div
 */
export function createDivWithHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

/**
 * Sets ARIA attributes
 * @param {HTMLElement} element - Target element
 * @param {Object} attributes - ARIA attributes
 */
export function setARIA(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
        if (value === null) {
            element.removeAttribute(ariaKey);
        } else {
            element.setAttribute(ariaKey, value);
        }
    });
}

/**
 * Creates and inserts a style element
 * @param {string} cssText - CSS content
 * @param {string} id - Style element ID
 * @returns {HTMLElement} Created style element
 */
export function insertStyles(cssText, id) {
    // Remove existing style with same ID
    const existing = document.getElementById(id);
    if (existing) {
        removeElement(existing);
    }

    // Create new style element
    const style = createElement('style', { id });
    style.textContent = cssText;
    document.head.appendChild(style);
    return style;
}

/**
 * Checks if element is visible in container
 * @param {HTMLElement} element - Element to check
 * @param {HTMLElement} container - Container element
 * @returns {boolean} Visibility status
 */
export function isElementVisible(element, container) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return (
        elementRect.top >= containerRect.top &&
        elementRect.left >= containerRect.left &&
        elementRect.bottom <= containerRect.bottom &&
        elementRect.right <= containerRect.right
    );
}

/**
 * Gets element's absolute position
 * @param {HTMLElement} element - Target element
 * @returns {Object} Position coordinates
 */
export function getAbsolutePosition(element) {
    const rect = element.getBoundingClientRect();
    return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
    };
}

/**
 * Ensures element is in view
 * @param {HTMLElement} element - Target element
 * @param {Object} options - Scroll options
 */
export function ensureInView(element, options = {}) {
    const {
        block = 'nearest',
        behavior = 'smooth'
    } = options;

    element.scrollIntoView({
        behavior,
        block
    });
}