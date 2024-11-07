/**
 * Settings Panel
 * Dynamically generates and manages settings UI from config structure
 */

import { createElement, getCSSVariable } from '../utils/dom.js';

export class SettingsPanel {
    constructor(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.panel = null;
        this.isVisible = false;
        this.controls = new Map();
        
        // Settings definitions with validation and formatting
        this.settingsDefinitions = {
            dimensions: {
                label: 'Dimensions',
                fields: {
                    min: {
                        width: { type: 'number', min: 200, max: 2000, step: 50 },
                        height: { type: 'number', min: 200, max: 2000, step: 50 }
                    },
                    aspectRatio: { type: 'number', min: 0.5, max: 2, step: 0.1 }
                }
            },
            node: {
                label: 'Node Settings',
                fields: {
                    central: {
                        label: 'Central Node',
                        size: { type: 'number', min: 60, max: 200, step: 10 },
                        padding: { type: 'number', min: 5, max: 30, step: 5 }
                    },
                    primary: {
                        label: 'Primary Nodes',
                        width: { type: 'number', min: 50, max: 150, step: 10 },
                        height: { type: 'number', min: 40, max: 120, step: 10 },
                        padding: { type: 'number', min: 5, max: 20, step: 5 }
                    },
                    secondary: {
                        label: 'Secondary Nodes',
                        width: { type: 'number', min: 40, max: 120, step: 10 },
                        height: { type: 'number', min: 30, max: 100, step: 10 },
                        padding: { type: 'number', min: 5, max: 20, step: 5 }
                    }
                }
            },
            text: {
                label: 'Text Settings',
                fields: {
                    sizes: {
                        small: this.createTextSizeDefinition('Small Screen'),
                        medium: this.createTextSizeDefinition('Medium Screen'),
                        large: this.createTextSizeDefinition('Large Screen')
                    },
                    spacing: {
                        label: 'Spacing',
                        base: { type: 'number', min: 20, max: 60, step: 2 },
                        side: { type: 'number', min: 10, max: 50, step: 5 }
                    }
                }
            },
            colors: {
                label: 'Colors',
                fields: {
                    node: this.createColorDefinitions('Node Colors'),
                    text: this.createColorDefinitions('Text Colors'),
                    path: this.createColorDefinitions('Path Colors')
                }
            }
        };
    }

    /**
     * Creates definitions for text sizes
     * @private
     */
    createTextSizeDefinition(label) {
        return {
            label,
            central: { type: 'number', min: 12, max: 24, step: 1 },
            primary: { type: 'number', min: 10, max: 20, step: 1 },
            secondary: { type: 'number', min: 8, max: 18, step: 1 }
        };
    }

    /**
     * Creates definitions for colors
     * @private
     */
    createColorDefinitions(label) {
        return {
            label,
            default: { type: 'color' },
            active: { type: 'color' },
            hover: { type: 'color' }
        };
    }

    /**
     * Creates the settings panel
     */
    create() {
        // Create panel container
        this.panel = createElement('div', {
            className: 'settings-panel',
            dataset: { id: `${this.parent.id}-settings` }
        });

        // Create header
        const header = this.createHeader();
        this.panel.appendChild(header);

        // Create settings content
        const content = createElement('div', {
            className: 'settings-content'
        });

        // Dynamically generate settings from config
        this.generateSettingsContent(content);

        this.panel.appendChild(content);
        document.body.appendChild(this.panel);

        // Create toggle button
        this.createToggleButton();
    }

    /**
     * Creates settings panel header
     * @private
     */
    createHeader() {
        const header = createElement('div', {
            className: 'settings-header'
        });

        const title = createElement('h2', {
            className: 'settings-title',
            textContent: 'Visualization Settings'
        });

        const actions = createElement('div', {
            className: 'settings-actions'
        });

        // Add export/import buttons
        const exportBtn = createElement('button', {
            className: 'settings-btn',
            textContent: '📤 Export'
        });
        exportBtn.addEventListener('click', () => this.exportSettings());

        const importBtn = createElement('button', {
            className: 'settings-btn',
            textContent: '📥 Import'
        });
        importBtn.addEventListener('click', () => this.importSettings());

        actions.appendChild(exportBtn);
        actions.appendChild(importBtn);

        header.appendChild(title);
        header.appendChild(actions);
        return header;
    }

    /**
     * Generates settings content from config
     * @private
     */
    generateSettingsContent(container) {
        // Recursively process config structure
        this.processConfigStructure(this.config, container, this.settingsDefinitions);
    }

    /**
     * Processes config structure recursively
     * @private
     */
    processConfigStructure(config, container, definitions, path = '') {
        Object.entries(definitions).forEach(([key, def]) => {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (def.fields) {
                // Create group for nested settings
                const group = this.createSettingsGroup(def.label || key);
                this.processConfigStructure(
                    config[key], 
                    group, 
                    def.fields, 
                    currentPath
                );
                container.appendChild(group);
            } else {
                // Create control for setting
                const control = this.createSettingControl(
                    key,
                    currentPath,
                    config[key],
                    def
                );
                if (control) {
                    container.appendChild(control);
                }
            }
        });
    }

    /**
     * Creates a settings group
     * @private
     */
    createSettingsGroup(label) {
        const group = createElement('div', {
            className: 'settings-group'
        });

        const header = createElement('div', {
            className: 'settings-group-header'
        });

        const title = createElement('h3', {
            textContent: label
        });

        header.appendChild(title);
        group.appendChild(header);
        return group;
    }

    /**
     * Creates a setting control
     * @private
     */
    createSettingControl(key, path, value, definition) {
        const control = createElement('div', {
            className: 'settings-control'
        });

        const label = createElement('label', {
            textContent: definition.label || this.formatLabel(key)
        });

        const input = this.createInput(path, value, definition);
        if (!input) return null;

        control.appendChild(label);
        control.appendChild(input);

        // Add hint for number inputs
        if (definition.type === 'number') {
            const hint = createElement('div', {
                className: 'settings-value-hint',
                textContent: `Min: ${definition.min}, Max: ${definition.max}`
            });
            control.appendChild(hint);
        }

        this.controls.set(path, input);
        return control;
    }

    /**
     * Creates an input element
     * @private
     */
    createInput(path, value, definition) {
        let input;

        switch (definition.type) {
            case 'number':
                input = createElement('input', {
                    type: 'number',
                    value: value,
                    min: definition.min,
                    max: definition.max,
                    step: definition.step || 1
                });
                break;

            case 'color':
                input = createElement('input', {
                    type: 'color',
                    value: this.rgbToHex(value)
                });
                break;

            default:
                return null;
        }

        // Add change handler
        input.addEventListener('change', () => {
            this.handleSettingChange(path, input.value, definition.type);
        });

        return input;
    }

    /**
     * Handles setting changes
     * @private
     */
    handleSettingChange(path, value, type) {
        // Convert value based on type
        const processedValue = type === 'number' ? parseFloat(value) : value;

        // Update config
        this.updateConfigValue(this.config, path.split('.'), processedValue);

        // Update visualization
        this.parent.update(null, this.config);
    }

    /**
     * Updates config value at path
     * @private
     */
    updateConfigValue(obj, path, value) {
        const key = path[0];
        if (path.length === 1) {
            obj[key] = value;
        } else {
            if (!obj[key]) obj[key] = {};
            this.updateConfigValue(obj[key], path.slice(1), value);
        }
    }

    /**
     * Formats label from camelCase
     * @private
     */
    formatLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    /**
     * Converts RGB to hex
     * @private
     */
    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        
        const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!rgbMatch) return rgb;

        const [_, r, g, b] = rgbMatch;
        return '#' + [r, g, b]
            .map(x => parseInt(x).toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Creates toggle button
     * @private
     */
    createToggleButton() {
        const button = createElement('button', {
            className: 'settings-toggle',
            textContent: '⚙️'
        });

        button.addEventListener('click', () => this.togglePanel());
        document.body.appendChild(button);
    }

    /**
     * Toggles panel visibility
     */
    togglePanel() {
        this.isVisible = !this.isVisible;
        this.panel.classList.toggle('visible', this.isVisible);
    }

    /**
     * Exports current settings
     */
    exportSettings() {
        const settings = {
            config: this.config,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob(
            [JSON.stringify(settings, null, 2)],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const a = createElement('a', {
            href: url,
            download: `circular-nav-settings-${Date.now()}.json`
        });

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Imports settings
     */
    importSettings() {
        const input = createElement('input', {
            type: 'file',
            accept: '.json'
        });

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target.result);
                    this.config = settings.config;
                    this.parent.update(null, this.config);
                    this.updateControlValues();
                } catch (error) {
                    console.error('Failed to import settings:', error);
                }
            };
            reader.readAsText(file);
        });

        input.click();
    }

    /**
     * Updates control values from config
     * @private
     */
    updateControlValues() {
        this.controls.forEach((control, path) => {
            const value = this.getConfigValue(this.config, path.split('.'));
            if (value !== undefined) {
                control.value = control.type === 'color' ? 
                    this.rgbToHex(value) : 
                    value;
            }
        });
    }

    /**
     * Gets config value at path
     * @private
     */
    getConfigValue(obj, path) {
        return path.reduce((curr, key) => curr?.[key], obj);
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.panel) {
            this.panel.remove();
        }
        const toggleButton = document.querySelector('.settings-toggle');
        if (toggleButton) {
            toggleButton.remove();
        }
        this.controls.clear();
    }
}