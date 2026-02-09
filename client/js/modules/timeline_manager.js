/**
 * TimelineManager - Manages step timing, ordering, and CRUD operations
 * 
 * Responsibilities:
 * - Calculate and maintain step startTime/endTime
 * - Insert/delete/reorder steps
 * - Track total duration
 * - Version migration
 * 
 * DOES NOT directly modify DOM or snapshots
 */

class TimelineManager extends EventEmitter {
    /**
     * @param {Object} scenarioData - Reference to scenarioData object
     */
    constructor(scenarioData) {
        super();
        this.scenarioData = scenarioData;

        // Ensure timeline metadata exists
        if (!this.scenarioData.timeline) {
            this.scenarioData.timeline = {
                enabled: true,
                totalDuration: 0,
                viewStart: 0,
                viewEnd: 10
            };
        }

        // Migrate if needed
        this._migrateIfNeeded();
    }

    // ========================================
    // STEP CRUD
    // ========================================

    /**
     * Add a step at the end
     * @param {Object} step - Step object
     * @returns {Object} The added step with timing calculated
     */
    addStep(step) {
        const scenario = this.scenarioData.scenario;

        // Calculate timing
        const prevStep = scenario.length > 0 ? scenario[scenario.length - 1] : null;
        step.startTime = prevStep ? prevStep.endTime : 0;
        step.endTime = step.startTime + (step.duration || 1.0);

        // Ensure required fields
        step.stepId = step.stepId || this._generateStepId();
        step.label = step.label || `Step ${step.stepId}`;
        step.color = step.color || this._getStepColor(step.stepId);

        scenario.push(step);
        this._updateTotalDuration();

        this.emit('stepAdded', { step, index: scenario.length - 1 });
        return step;
    }

    /**
     * Update an existing step
     * @param {number} stepIndex - Index in scenario array
     * @param {Object} updates - Properties to update
     * @returns {Object} Updated step
     */
    updateStep(stepIndex, updates) {
        const scenario = this.scenarioData.scenario;
        if (stepIndex < 0 || stepIndex >= scenario.length) {
            throw new Error(`Invalid step index: ${stepIndex}`);
        }

        const step = scenario[stepIndex];
        const oldDuration = step.duration;

        // Apply updates
        Object.assign(step, updates);

        // Recalculate endTime if duration changed
        if (updates.duration !== undefined) {
            step.endTime = step.startTime + step.duration;

            // Cascade timing changes to subsequent steps
            if (updates.duration !== oldDuration) {
                this._recalculateTimingFrom(stepIndex + 1);
            }
        }

        // Recalculate if startTime changed
        if (updates.startTime !== undefined) {
            step.endTime = step.startTime + step.duration;
            this._recalculateTimingFrom(stepIndex + 1);
        }

        this._updateTotalDuration();
        this.emit('stepUpdated', { step, index: stepIndex, updates });

        return step;
    }

    /**
     * Delete a step
     * @param {number} stepIndex - Index to delete
     * @returns {Object} Deleted step
     */
    deleteStep(stepIndex) {
        const scenario = this.scenarioData.scenario;
        if (stepIndex < 0 || stepIndex >= scenario.length) {
            throw new Error(`Invalid step index: ${stepIndex}`);
        }

        const deletedStep = scenario.splice(stepIndex, 1)[0];

        // Recalculate timing for remaining steps
        this._recalculateTimingFrom(stepIndex);
        this._updateTotalDuration();

        this.emit('stepDeleted', { step: deletedStep, index: stepIndex });
        return deletedStep;
    }

    /**
     * Clear all steps
     */
    clearSteps() {
        this.scenarioData.scenario = [];
        this._updateTotalDuration();
        this.emit('stepsCleared');
    }

    /**
     * Insert a step after a given index
     * @param {number} afterIndex - Insert after this index (-1 for beginning)
     * @param {Object} step - Step to insert
     * @returns {Object} Inserted step
     */
    insertStepAfter(afterIndex, step) {
        const scenario = this.scenarioData.scenario;
        const insertIndex = afterIndex + 1;

        // Calculate timing based on position
        if (afterIndex === -1) {
            // Insert at beginning
            step.startTime = 0;
        } else if (afterIndex < scenario.length) {
            // Insert after existing step
            step.startTime = scenario[afterIndex].endTime;
        } else {
            // Append at end
            return this.addStep(step);
        }

        step.duration = step.duration || 1.0;
        step.endTime = step.startTime + step.duration;
        step.stepId = step.stepId || this._generateStepId();
        step.label = step.label || `Step ${step.stepId}`;
        step.color = step.color || this._getStepColor(step.stepId);

        // Insert into array
        scenario.splice(insertIndex, 0, step);

        // Recalculate timing for all steps after insertion
        this._recalculateTimingFrom(insertIndex + 1);
        this._updateTotalDuration();

        this.emit('stepInserted', { step, index: insertIndex, afterIndex });
        return step;
    }

    /**
     * Move a step to a new position
     * @param {number} fromIndex - Current index
     * @param {number} toIndex - Target index
     */
    moveStep(fromIndex, toIndex) {
        const scenario = this.scenarioData.scenario;
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= scenario.length) return;
        if (toIndex < 0 || toIndex >= scenario.length) return;

        const [step] = scenario.splice(fromIndex, 1);
        scenario.splice(toIndex, 0, step);

        // Recalculate all timing
        this._recalculateTimingFrom(0);
        this._updateTotalDuration();

        this.emit('stepMoved', { step, fromIndex, toIndex });
    }

    // ========================================
    // TIMING QUERIES
    // ========================================

    /**
     * Get total timeline duration
     * @returns {number} Duration in seconds
     */
    getTotalDuration() {
        return this.scenarioData.timeline.totalDuration;
    }

    /**
     * Get step at a specific time
     * @param {number} time - Time in seconds
     * @returns {Object|null} Step at that time, or null if none
     */
    getStepAtTime(time) {
        const scenario = this.scenarioData.scenario;
        for (let i = 0; i < scenario.length; i++) {
            const step = scenario[i];
            if (time >= step.startTime && time <= step.endTime) {
                return { step, index: i };
            }
        }
        return null;
    }

    /**
     * Get step by ID
     * @param {number} stepId - Step ID
     * @returns {Object|null} Step and index, or null
     */
    getStepById(stepId) {
        const scenario = this.scenarioData.scenario;
        for (let i = 0; i < scenario.length; i++) {
            if (scenario[i].stepId === stepId) {
                return { step: scenario[i], index: i };
            }
        }
        return null;
    }

    /**
     * Get all steps
     * @returns {Array} Copy of scenario array
     */
    getSteps() {
        return [...this.scenarioData.scenario];
    }

    /**
     * Get step count
     * @returns {number}
     */
    getStepCount() {
        return this.scenarioData.scenario.length;
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    /**
     * Recalculate timing for steps starting from given index
     * @private
     */
    _recalculateTimingFrom(fromIndex) {
        const scenario = this.scenarioData.scenario;

        for (let i = fromIndex; i < scenario.length; i++) {
            const step = scenario[i];
            const prevStep = i > 0 ? scenario[i - 1] : null;

            step.startTime = prevStep ? prevStep.endTime : 0;
            step.endTime = step.startTime + step.duration;
        }
    }

    /**
     * Update total duration in timeline metadata
     * @private
     */
    _updateTotalDuration() {
        const scenario = this.scenarioData.scenario;
        if (scenario.length === 0) {
            this.scenarioData.timeline.totalDuration = 0;
        } else {
            this.scenarioData.timeline.totalDuration = scenario[scenario.length - 1].endTime;
        }
    }

    /**
     * Generate unique step ID
     * @private
     */
    _generateStepId() {
        const scenario = this.scenarioData.scenario;
        let maxId = 0;
        scenario.forEach(step => {
            if (step.stepId > maxId) maxId = step.stepId;
        });
        return maxId + 1;
    }

    /**
     * Get color for step (cycling through palette)
     * @private
     */
    _getStepColor(stepId) {
        const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722'];
        return colors[(stepId - 1) % colors.length];
    }

    /**
     * Migrate old data format to new format
     * @private
     */
    _migrateIfNeeded() {
        const data = this.scenarioData;

        // Check if already migrated
        if (data.version === '2.5-timeline') return;

        // Add version
        data.version = '2.5-timeline';

        // Add timeline metadata
        if (!data.timeline) {
            data.timeline = {
                enabled: true,
                totalDuration: 0,
                viewStart: 0,
                viewEnd: 10
            };
        }

        // Calculate timing for existing steps
        let currentTime = 0;
        data.scenario.forEach((step, index) => {
            if (step.startTime === undefined) {
                step.startTime = currentTime;
            }
            if (step.endTime === undefined) {
                step.endTime = step.startTime + (step.duration || 1.0);
            }
            if (!step.label) {
                step.label = `Step ${step.stepId}`;
            }
            if (!step.color) {
                step.color = this._getStepColor(step.stepId);
            }
            currentTime = step.endTime;
        });

        this._updateTotalDuration();

        console.log('[TimelineManager] Migrated data to v2.5-timeline');
    }

    // ========================================
    // STATIC METHODS
    // ========================================

    /**
     * Run unit tests
     */
    static test() {
        console.log('[TimelineManager] Running tests...');

        // Test 1: Add steps and calculate duration
        const testData = { scenario: [], timeline: {} };
        const tm = new TimelineManager(testData);

        tm.addStep({ duration: 1.5, actions: [] });
        tm.addStep({ duration: 1.0, actions: [] });

        console.assert(
            tm.getTotalDuration() === 2.5,
            `Test 1 failed: Expected 2.5, got ${tm.getTotalDuration()}`
        );
        console.assert(
            testData.scenario[0].startTime === 0,
            'Test 1b failed: First step startTime should be 0'
        );
        console.assert(
            testData.scenario[1].startTime === 1.5,
            'Test 1c failed: Second step startTime should be 1.5'
        );

        // Test 2: Insert step
        tm.insertStepAfter(0, { duration: 0.5, actions: [] });
        console.assert(
            testData.scenario.length === 3,
            'Test 2 failed: Should have 3 steps'
        );
        console.assert(
            testData.scenario[1].startTime === 1.5,
            'Test 2b failed: Inserted step startTime should be 1.5'
        );
        console.assert(
            testData.scenario[2].startTime === 2.0,
            `Test 2c failed: Shifted step startTime should be 2.0, got ${testData.scenario[2].startTime}`
        );

        // Test 3: Delete step
        tm.deleteStep(1);
        console.assert(
            testData.scenario.length === 2,
            'Test 3 failed: Should have 2 steps after delete'
        );
        console.assert(
            tm.getTotalDuration() === 2.5,
            'Test 3b failed: Duration should be back to 2.5'
        );

        // Test 4: Get step at time
        const result = tm.getStepAtTime(0.5);
        console.assert(
            result !== null && result.index === 0,
            'Test 4 failed: Should find step at time 0.5'
        );

        console.log('[TimelineManager] All tests passed ✓');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineManager;
}
