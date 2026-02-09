/**
 * StepPropertyManager - Manages per-step card properties
 * 
 * Responsibilities:
 * - Store flip/slam properties scoped to specific step + card
 * - Prevent sticky flag issue (properties don't leak between steps)
 * - Track property history per card
 * 
 * Data structure:
 * {
 *   [stepId]: {
 *     [cardId]: {
 *       flip: { enabled: boolean, toFaceUp: boolean },
 *       slam: { enabled: boolean, intensity: number }
 *     }
 *   }
 * }
 */

class StepPropertyManager extends EventEmitter {
    constructor() {
        super();
        this._properties = {};
        this._pendingProperties = {};  // Temporary during step editing
    }

    // ========================================
    // PROPERTY SETTERS/GETTERS
    // ========================================

    /**
     * Set a property for a card in a specific step
     * @param {number} stepId - Step ID
     * @param {string} cardId - Card ID
     * @param {string} propName - Property name ('flip' or 'slam')
     * @param {Object} value - Property value
     */
    setProperty(stepId, cardId, propName, value) {
        if (!this._properties[stepId]) {
            this._properties[stepId] = {};
        }
        if (!this._properties[stepId][cardId]) {
            this._properties[stepId][cardId] = {};
        }

        this._properties[stepId][cardId][propName] = value;

        this.emit('propertyChanged', { stepId, cardId, propName, value });
    }

    /**
     * Get a property for a card in a specific step
     * @param {number} stepId - Step ID
     * @param {string} cardId - Card ID
     * @param {string} propName - Property name
     * @returns {Object|undefined} Property value or undefined
     */
    getProperty(stepId, cardId, propName) {
        return this._properties[stepId]?.[cardId]?.[propName];
    }

    /**
     * Get all properties for a card in a step
     * @param {number} stepId - Step ID
     * @param {string} cardId - Card ID
     * @returns {Object} All properties for this card in this step
     */
    getCardPropertiesInStep(stepId, cardId) {
        return this._properties[stepId]?.[cardId] || {};
    }

    /**
     * Get all card properties for a step
     * @param {number} stepId - Step ID
     * @returns {Object} Map of cardId -> properties
     */
    getStepProperties(stepId) {
        return this._properties[stepId] || {};
    }

    /**
     * Check if a card has any properties set for a step
     * @param {number} stepId - Step ID
     * @param {string} cardId - Card ID
     * @returns {boolean}
     */
    hasProperties(stepId, cardId) {
        const props = this._properties[stepId]?.[cardId];
        if (!props) return false;
        return Object.keys(props).length > 0;
    }

    // ========================================
    // PENDING PROPERTIES (During Editing)
    // ========================================

    /**
     * Set pending property (during step editing, before commit)
     * @param {string} cardId - Card ID
     * @param {string} propName - Property name
     * @param {Object} value - Property value
     */
    setPendingProperty(cardId, propName, value) {
        if (!this._pendingProperties[cardId]) {
            this._pendingProperties[cardId] = {};
        }
        this._pendingProperties[cardId][propName] = value;
    }

    /**
     * Get pending property
     * @param {string} cardId - Card ID
     * @param {string} propName - Property name
     * @returns {Object|undefined}
     */
    getPendingProperty(cardId, propName) {
        return this._pendingProperties[cardId]?.[propName];
    }

    /**
     * Commit pending properties to a step
     * @param {number} stepId - Step ID to commit to
     */
    commitPendingProperties(stepId) {
        Object.entries(this._pendingProperties).forEach(([cardId, props]) => {
            Object.entries(props).forEach(([propName, value]) => {
                this.setProperty(stepId, cardId, propName, value);
            });
        });

        this.clearPendingProperties();
        this.emit('propertiesCommitted', { stepId });
    }

    /**
     * Clear all pending properties (cancel edit)
     */
    clearPendingProperties() {
        this._pendingProperties = {};
    }

    /**
     * Get all pending properties
     * @returns {Object}
     */
    getPendingProperties() {
        return { ...this._pendingProperties };
    }

    // ========================================
    // CARD HISTORY
    // ========================================

    /**
     * Get property history for a card across all steps
     * @param {string} cardId - Card ID
     * @returns {Array} Array of { stepId, properties }
     */
    getCardHistory(cardId) {
        const history = [];

        Object.entries(this._properties).forEach(([stepId, cards]) => {
            if (cards[cardId]) {
                history.push({
                    stepId: parseInt(stepId),
                    properties: { ...cards[cardId] }
                });
            }
        });

        // Sort by stepId
        history.sort((a, b) => a.stepId - b.stepId);

        return history;
    }

    /**
     * Get all steps where a card has flip property set
     * @param {string} cardId - Card ID
     * @returns {Array} Array of step IDs
     */
    getCardFlipSteps(cardId) {
        const steps = [];

        Object.entries(this._properties).forEach(([stepId, cards]) => {
            if (cards[cardId]?.flip?.enabled) {
                steps.push(parseInt(stepId));
            }
        });

        return steps.sort((a, b) => a - b);
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Clear all properties for a step
     * @param {number} stepId - Step ID
     */
    clearStepProperties(stepId) {
        delete this._properties[stepId];
        this.emit('stepCleared', { stepId });
    }

    /**
     * Remove a card from a step
     * @param {number} stepId - Step ID
     * @param {string} cardId - Card ID
     */
    clearCardFromStep(stepId, cardId) {
        if (this._properties[stepId]) {
            delete this._properties[stepId][cardId];
        }
    }

    /**
     * Clear all properties
     */
    clearAll() {
        this._properties = {};
        this._pendingProperties = {};
        this.emit('cleared');
    }

    // ========================================
    // SERIALIZATION
    // ========================================

    /**
     * Convert to JSON-serializable object
     * @returns {Object}
     */
    toJSON() {
        return JSON.parse(JSON.stringify(this._properties));
    }

    /**
     * Load from JSON data
     * @param {Object} data - Serialized properties
     */
    loadFromJSON(data) {
        this._properties = JSON.parse(JSON.stringify(data || {}));
    }

    /**
     * Create from JSON data (static factory)
     * @param {Object} data - Serialized properties
     * @returns {StepPropertyManager}
     */
    static fromJSON(data) {
        const manager = new StepPropertyManager();
        manager.loadFromJSON(data);
        return manager;
    }

    // ========================================
    // MERGE FROM ACTIONS (Migration helper)
    // ========================================

    /**
     * Extract properties from existing step actions
     * Used for migrating old format to new format
     * @param {Array} scenario - Scenario array from scenarioData
     */
    migrateFromActions(scenario) {
        scenario.forEach(step => {
            if (!step.actions) return;

            step.actions.forEach(action => {
                const cardId = action.targetId;

                if (action.flip !== undefined) {
                    this.setProperty(step.stepId, cardId, 'flip', {
                        enabled: action.flip === true,
                        toFaceUp: action.flipToFaceUp
                    });
                }

                if (action.effect === 'SLAM') {
                    this.setProperty(step.stepId, cardId, 'slam', {
                        enabled: true,
                        intensity: 1.08
                    });
                }
            });
        });
    }

    // ========================================
    // STATIC METHODS
    // ========================================

    /**
     * Run unit tests
     */
    static test() {
        console.log('[StepPropertyManager] Running tests...');

        const spm = new StepPropertyManager();

        // Test 1: Set and get property
        spm.setProperty(1, 'card_A', 'flip', { enabled: true, toFaceUp: false });
        const flip = spm.getProperty(1, 'card_A', 'flip');
        console.assert(
            flip && flip.enabled === true,
            'Test 1 failed: Should get flip property'
        );

        // Test 2: Properties are scoped to step
        const flip2 = spm.getProperty(2, 'card_A', 'flip');
        console.assert(
            flip2 === undefined,
            'Test 2 failed: Step 2 should not have flip (scoped to step 1)'
        );

        // Test 3: Pending properties
        spm.setPendingProperty('card_B', 'slam', { enabled: true });
        console.assert(
            spm.getPendingProperty('card_B', 'slam')?.enabled === true,
            'Test 3 failed: Should have pending slam'
        );
        spm.commitPendingProperties(3);
        console.assert(
            spm.getProperty(3, 'card_B', 'slam')?.enabled === true,
            'Test 3b failed: Pending should be committed'
        );
        console.assert(
            Object.keys(spm.getPendingProperties()).length === 0,
            'Test 3c failed: Pending should be cleared after commit'
        );

        // Test 4: Card history
        spm.setProperty(5, 'card_A', 'flip', { enabled: true, toFaceUp: true });
        const history = spm.getCardHistory('card_A');
        console.assert(
            history.length === 2,
            'Test 4 failed: card_A should have 2 history entries'
        );
        console.assert(
            history[0].stepId === 1 && history[1].stepId === 5,
            'Test 4b failed: History should be sorted by stepId'
        );

        // Test 5: Serialization
        const json = spm.toJSON();
        const loaded = StepPropertyManager.fromJSON(json);
        console.assert(
            loaded.getProperty(1, 'card_A', 'flip')?.enabled === true,
            'Test 5 failed: Should load from JSON correctly'
        );

        console.log('[StepPropertyManager] All tests passed ✓');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StepPropertyManager;
}
