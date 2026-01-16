/**
 * EventEmitter - Simple event system for modules
 * Allows modules to communicate without tight coupling
 */

class EventEmitter {
    constructor() {
        this._events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);

        // Return unsubscribe function
        return () => {
            this._events[event] = this._events[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Subscribe once - automatically unsubscribes after first call
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback(...args);
        });
        return unsubscribe;
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to callbacks
     */
    emit(event, ...args) {
        if (this._events[event]) {
            this._events[event].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, removes all if not provided)
     */
    off(event) {
        if (event) {
            delete this._events[event];
        } else {
            this._events = {};
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        return this._events[event]?.length || 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventEmitter;
}
