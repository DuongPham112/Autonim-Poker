/**
 * SnapshotManager - Manages card state snapshots for replay and editing
 * 
 * Responsibilities:
 * - Store and manage stepSnapshots array
 * - Insert/delete snapshots when steps change
 * - Handle snapshot restoration with animation
 * - Support interpolation between snapshots
 * 
 * Snapshot structure:
 * {
 *   [cardId]: {
 *     x: number,
 *     y: number,
 *     rotation: number,
 *     isFaceUp: boolean,
 *     zone: string,
 *     zonePosition: number
 *   }
 * }
 */

class SnapshotManager extends EventEmitter {
    constructor() {
        super();
        this._snapshots = [];
        this._history = [];  // For future undo/redo
        this._maxHistory = 50;
    }

    // ========================================
    // SNAPSHOT CRUD
    // ========================================

    /**
     * Add a snapshot at the end
     * @param {Object} snapshot - Snapshot object
     * @returns {number} Index of added snapshot
     */
    addSnapshot(snapshot) {
        const cloned = this._deepClone(snapshot);
        this._snapshots.push(cloned);

        this.emit('snapshotAdded', { snapshot: cloned, index: this._snapshots.length - 1 });
        return this._snapshots.length - 1;
    }

    /**
     * Update a snapshot at given index
     * @param {number} index - Snapshot index
     * @param {Object} snapshot - New snapshot data
     */
    updateSnapshot(index, snapshot) {
        if (index < 0 || index >= this._snapshots.length) {
            throw new Error(`Invalid snapshot index: ${index}`);
        }

        const oldSnapshot = this._snapshots[index];
        const cloned = this._deepClone(snapshot);
        this._snapshots[index] = cloned;

        this.emit('snapshotUpdated', { index, oldSnapshot, newSnapshot: cloned });
    }

    /**
     * Delete a snapshot at given index
     * @param {number} index - Snapshot index
     * @returns {Object} Deleted snapshot
     */
    deleteSnapshot(index) {
        if (index < 0 || index >= this._snapshots.length) {
            throw new Error(`Invalid snapshot index: ${index}`);
        }

        const deleted = this._snapshots.splice(index, 1)[0];

        this.emit('snapshotDeleted', { index, snapshot: deleted });
        return deleted;
    }

    /**
     * Insert a snapshot at given index
     * @param {number} index - Where to insert
     * @param {Object} snapshot - Snapshot to insert
     */
    insertSnapshot(index, snapshot) {
        if (index < 0 || index > this._snapshots.length) {
            throw new Error(`Invalid snapshot index: ${index}`);
        }

        const cloned = this._deepClone(snapshot);
        this._snapshots.splice(index, 0, cloned);

        this.emit('snapshotInserted', { index, snapshot: cloned });
    }

    // ========================================
    // ACCESSORS
    // ========================================

    /**
     * Get snapshot at index
     * @param {number} index - Snapshot index
     * @returns {Object|null} Snapshot or null
     */
    getSnapshot(index) {
        if (index < 0 || index >= this._snapshots.length) {
            return null;
        }
        return this._deepClone(this._snapshots[index]);
    }

    /**
     * Get initial snapshot (index 0)
     * @returns {Object|null}
     */
    getInitialSnapshot() {
        return this.getSnapshot(0);
    }

    /**
     * Get latest snapshot
     * @returns {Object|null}
     */
    getLatestSnapshot() {
        return this.getSnapshot(this._snapshots.length - 1);
    }

    /**
     * Get snapshot count
     * @returns {number}
     */
    getSnapshotCount() {
        return this._snapshots.length;
    }

    /**
     * Get all snapshots (cloned)
     * @returns {Array}
     */
    getAllSnapshots() {
        return this._snapshots.map(s => this._deepClone(s));
    }

    // ========================================
    // INTERPOLATION
    // ========================================

    /**
     * Interpolate between two snapshots
     * @param {number} indexA - Start snapshot index
     * @param {number} indexB - End snapshot index
     * @param {number} t - Interpolation factor (0-1)
     * @returns {Object} Interpolated snapshot
     */
    interpolate(indexA, indexB, t) {
        const snapA = this._snapshots[indexA];
        const snapB = this._snapshots[indexB];

        if (!snapA || !snapB) {
            console.warn('[SnapshotManager] Invalid indices for interpolation');
            return snapA || snapB || {};
        }

        const result = {};

        // Get all card IDs from both snapshots
        const allCardIds = new Set([
            ...Object.keys(snapA),
            ...Object.keys(snapB)
        ]);

        allCardIds.forEach(cardId => {
            const stateA = snapA[cardId];
            const stateB = snapB[cardId];

            if (!stateA && stateB) {
                // Card appears in B but not A - use B if t > 0.5
                result[cardId] = t > 0.5 ? this._deepClone(stateB) : null;
            } else if (stateA && !stateB) {
                // Card in A but not B - use A if t < 0.5
                result[cardId] = t < 0.5 ? this._deepClone(stateA) : null;
            } else if (stateA && stateB) {
                // Card in both - interpolate
                result[cardId] = {
                    x: this._lerp(stateA.x || 0, stateB.x || 0, t),
                    y: this._lerp(stateA.y || 0, stateB.y || 0, t),
                    rotation: this._lerp(stateA.rotation || 0, stateB.rotation || 0, t),
                    isFaceUp: t < 0.5 ? stateA.isFaceUp : stateB.isFaceUp,
                    zone: t < 0.5 ? stateA.zone : stateB.zone,
                    zonePosition: t < 0.5 ? stateA.zonePosition : stateB.zonePosition
                };
            }
        });

        // Remove null entries
        Object.keys(result).forEach(key => {
            if (result[key] === null) delete result[key];
        });

        return result;
    }

    /**
     * Get card state at specific time (with interpolation)
     * @param {number} time - Time in seconds
     * @param {Array} steps - Scenario steps with timing info
     * @returns {Object} Interpolated snapshot
     */
    getStateAtTime(time, steps) {
        if (steps.length === 0 || this._snapshots.length === 0) {
            return this.getInitialSnapshot() || {};
        }

        // Before first step
        if (time < 0) {
            return this.getInitialSnapshot();
        }

        // Find which step this time falls in
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            if (time >= step.startTime && time <= step.endTime) {
                // Guard: need snapshot at i+1 to interpolate
                if (i + 1 >= this._snapshots.length) {
                    // Not enough snapshots — return the last available
                    return this.getSnapshot(this._snapshots.length - 1) || {};
                }
                // Guard: avoid division by zero for zero-duration steps
                const duration = step.duration || step.endTime - step.startTime;
                const progress = duration > 0
                    ? Math.min((time - step.startTime) / duration, 1)
                    : 1;
                return this.interpolate(i, i + 1, progress);
            }
        }

        // After last step
        return this.getLatestSnapshot();
    }

    // ========================================
    // BULK OPERATIONS
    // ========================================

    /**
     * Load from array (e.g., existing stepSnapshots)
     * @param {Array} snapshots - Array of snapshots
     */
    loadFromArray(snapshots) {
        this._snapshots = snapshots.map(s => this._deepClone(s));
        this.emit('loaded', { count: this._snapshots.length });
    }

    /**
     * Clear all snapshots
     */
    clear() {
        this._snapshots = [];
        this.emit('cleared');
    }

    /**
     * Reset to initial state only
     * @param {Object} initialSnapshot - Initial snapshot
     */
    resetToInitial(initialSnapshot) {
        this._snapshots = [this._deepClone(initialSnapshot)];
        this.emit('reset', { initial: initialSnapshot });
    }

    // ========================================
    // CARD OPERATIONS
    // ========================================

    /**
     * Get card state from a specific snapshot
     * @param {number} snapshotIndex - Snapshot index
     * @param {string} cardId - Card ID
     * @returns {Object|null} Card state or null
     */
    getCardState(snapshotIndex, cardId) {
        const snapshot = this._snapshots[snapshotIndex];
        if (!snapshot) return null;
        return snapshot[cardId] ? this._deepClone(snapshot[cardId]) : null;
    }

    /**
     * Track card across all snapshots
     * @param {string} cardId - Card ID
     * @returns {Array} Array of { snapshotIndex, state }
     */
    trackCard(cardId) {
        const track = [];

        this._snapshots.forEach((snapshot, index) => {
            if (snapshot[cardId]) {
                track.push({
                    snapshotIndex: index,
                    state: this._deepClone(snapshot[cardId])
                });
            }
        });

        return track;
    }

    // ========================================
    // SERIALIZATION
    // ========================================

    /**
     * Convert to JSON-serializable array
     * @returns {Array}
     */
    toJSON() {
        return this._snapshots.map(s => this._deepClone(s));
    }

    /**
     * Create from JSON data
     * @param {Array} data - Array of snapshots
     * @returns {SnapshotManager}
     */
    static fromJSON(data) {
        const manager = new SnapshotManager();
        manager.loadFromArray(data || []);
        return manager;
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    /**
     * Deep clone an object
     * @private
     */
    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Linear interpolation
     * @private
     */
    _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ========================================
    // STATIC METHODS
    // ========================================

    /**
     * Run unit tests
     */
    static test() {
        console.log('[SnapshotManager] Running tests...');

        const sm = new SnapshotManager();

        // Test 1: Add snapshots
        sm.addSnapshot({
            card_A: { x: 100, y: 200, rotation: 0, isFaceUp: false }
        });
        sm.addSnapshot({
            card_A: { x: 500, y: 400, rotation: 45, isFaceUp: true }
        });

        console.assert(
            sm.getSnapshotCount() === 2,
            'Test 1 failed: Should have 2 snapshots'
        );

        // Test 2: Get snapshot (should be cloned)
        const snap = sm.getSnapshot(0);
        snap.card_A.x = 999;  // Modify clone
        console.assert(
            sm.getSnapshot(0).card_A.x === 100,
            'Test 2 failed: Original should not be modified'
        );

        // Test 3: Interpolation
        const interpolated = sm.interpolate(0, 1, 0.5);
        console.assert(
            interpolated.card_A.x === 300,  // Midpoint of 100 and 500
            `Test 3 failed: Expected x=300, got ${interpolated.card_A.x}`
        );
        console.assert(
            interpolated.card_A.rotation === 22.5,  // Midpoint of 0 and 45
            `Test 3b failed: Expected rotation=22.5, got ${interpolated.card_A.rotation}`
        );

        // Test 4: Insert snapshot
        sm.insertSnapshot(1, {
            card_A: { x: 250, y: 300, rotation: 20, isFaceUp: false }
        });
        console.assert(
            sm.getSnapshotCount() === 3,
            'Test 4 failed: Should have 3 snapshots after insert'
        );
        console.assert(
            sm.getSnapshot(1).card_A.x === 250,
            'Test 4b failed: Inserted snapshot should be at index 1'
        );

        // Test 5: Delete snapshot
        sm.deleteSnapshot(1);
        console.assert(
            sm.getSnapshotCount() === 2,
            'Test 5 failed: Should have 2 snapshots after delete'
        );

        // Test 6: Track card
        const track = sm.trackCard('card_A');
        console.assert(
            track.length === 2,
            'Test 6 failed: card_A should appear in 2 snapshots'
        );

        console.log('[SnapshotManager] All tests passed ✓');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnapshotManager;
}
