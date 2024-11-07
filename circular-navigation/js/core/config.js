/**
 * Default configuration and profiles
 */

export const DEFAULT_CONFIG = {
    dimensions: {
        min: {
            width: 800,
            height: 600
        },
        aspectRatio: 1.25,
        breakpoints: {
            small: 768,
            medium: 1024,
            large: 1440
        }
    },
    
    animation: {
        duration: 500,
        delayOffset: 50,
        minDuration: 200,
        maxDuration: 1000
    },

    zoom: {
        min: 0.5,
        max: 3,
        step: 0.1,
        transitionDuration: 250
    },

    node: {
        central: {
            size: 90,
            padding: 15,
            minSize: 60
        },
        primary: {
            width: 75,
            height: 60,
            padding: 10,
            minWidth: 50,
            minHeight: 40
        },
        secondary: {
            width: 60,
            height: 45,
            padding: 8,
            minWidth: 40,
            minHeight: 30
        }
    },

    indicator: {
        inner: {
            radius: 5,
            activeScale: 1.2
        },
        outer: {
            radius: 8,
            padding: 4
        }
    },

    text: {
        sizes: {
            small: {
                central: 14,
                primary: 12,
                secondary: 10
            },
            medium: {
                central: 16,
                primary: 14,
                secondary: 12
            },
            large: {
                central: 18,
                primary: 16,
                secondary: 14
            }
        },
        spacing: {
            base: 32,
            side: 30,
            min: 0
        },
        thresholds: {
            longText: 11,
            wrap: 15
        }
    },

    colors: {
        node: {
            default: 'var(--node-bg-default)',
            hover: 'var(--node-bg-hover)',
            active: 'var(--node-bg-active)',
            central: 'var(--node-bg-central)'
        },
        text: {
            default: 'var(--text-default)',
            hover: 'var(--text-hover)',
            active: 'var(--text-active)'
        },
        path: {
            default: 'var(--link-default)',
            active: 'var(--link-active)',
            inactive: 'var(--link-inactive)'
        },
        indicator: {
            default: 'var(--link-inactive)',
            active: 'var(--link-active)',
            hover: 'var(--link-default)'
        }
    },

    profiles: {
        mobile: {
            textSizes: {
                central: 14,
                primary: 12,
                secondary: 10
            },
            nodeSizes: {
                central: 80,
                primary: {
                    width: 60,
                    height: 45
                },
                secondary: {
                    width: 50,
                    height: 35
                }
            },
            spacing: {
                node: 8,
                text: 4,
                indicator: 3
            }
        },
        tablet: {
            textSizes: {
                central: 16,
                primary: 14,
                secondary: 12
            },
            nodeSizes: {
                central: 90,
                primary: {
                    width: 70,
                    height: 55
                },
                secondary: {
                    width: 60,
                    height: 45
                }
            },
            spacing: {
                node: 10,
                text: 5,
                indicator: 4
            }
        },
        desktop: {
            textSizes: {
                central: 18,
                primary: 16,
                secondary: 14
            },
            nodeSizes: {
                central: 100,
                primary: {
                    width: 80,
                    height: 65
                },
                secondary: {
                    width: 70,
                    height: 55
                }
            },
            spacing: {
                node: 12,
                text: 6,
                indicator: 5
            }
        }
    },

    cache: {
        maxSize: 50,
        preloadDelay: 1000,
        cleanupThreshold: 0.8
    },

    performance: {
        debounceDelay: 250,
        throttleDelay: 100,
        batchSize: 10,
        maxTransitions: 5
    }
};

export const CSS_VARIABLES = [
    '--node-bg-default',
    '--node-bg-hover',
    '--node-bg-active',
    '--node-bg-central',
    '--text-default',
    '--text-hover',
    '--text-active',
    '--link-default',
    '--link-active',
    '--link-inactive'
];

export function validateConfig(config) {
    // Check if essential structures exist
    if (!config.dimensions) config.dimensions = DEFAULT_CONFIG.dimensions;
    if (!config.node) config.node = DEFAULT_CONFIG.node;
    if (!config.text) config.text = DEFAULT_CONFIG.text;
    if (!config.colors) config.colors = DEFAULT_CONFIG.colors;

    return true;
}