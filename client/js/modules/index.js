/**
 * Timeline Modules - Index File
 * 
 * This file exports all timeline-related modules for easy importing.
 * 
 * Usage in HTML:
 * <script src="js/utils/event_emitter.js"></script>
 * <script src="js/modules/timeline_manager.js"></script>
 * <script src="js/modules/step_property_manager.js"></script>
 * <script src="js/modules/snapshot_manager.js"></script>
 * <script src="js/modules/playback_controller.js"></script>
 * <script src="js/modules/index.js"></script>
 */

// Feature flags - can be overridden before init
const TIMELINE_FEATURE_FLAGS = {
    ENABLED: true,           // Master switch for timeline features
    TIMELINE_UI: true,       // Show timeline panel
    EDIT_STEPS: true,        // Enable edit existing steps
    BACKWARD_PLAY: true,     // Enable backward playback
    PER_STEP_PROPS: true,    // Per-step property storage
    SCRUBBING: true,         // Enable timeline scrubbing
    API_SYNC: false          // Backend sync (future)
};

// Version info
const TIMELINE_VERSION = '2.5-timeline';

/**
 * Initialize all timeline modules
 * @param {Object} scenarioData - Reference to main scenarioData object
 * @param {Array} stepSnapshots - Reference to stepSnapshots array
 * @param {Function} restoreFromSnapshot - Callback to restore card positions
 * @returns {Object} Object containing all module instances
 */
function initTimelineModules(scenarioData, stepSnapshots, restoreFromSnapshot) {
    if (!TIMELINE_FEATURE_FLAGS.ENABLED) {
        console.log('[Timeline] Modules disabled via feature flag');
        return null;
    }

    console.log('[Timeline] Initializing modules...');

    // Create module instances
    const timelineManager = new TimelineManager(scenarioData);
    const stepPropertyManager = new StepPropertyManager();
    const snapshotManager = new SnapshotManager();

    // Load existing snapshots
    if (stepSnapshots && stepSnapshots.length > 0) {
        snapshotManager.loadFromArray(stepSnapshots);
    }

    // Create playback controller
    const playbackController = new PlaybackController({
        timelineManager: timelineManager,
        snapshotManager: snapshotManager,
        onRender: (snapshot) => {
            if (restoreFromSnapshot) {
                restoreFromSnapshot(snapshot);
            }
        }
    });

    // Extract properties from existing actions
    if (scenarioData.scenario && scenarioData.scenario.length > 0) {
        stepPropertyManager.migrateFromActions(scenarioData.scenario);
    }

    // Create module bundle
    const modules = {
        timelineManager,
        stepPropertyManager,
        snapshotManager,
        playbackController,

        // Utility methods
        flags: TIMELINE_FEATURE_FLAGS,
        version: TIMELINE_VERSION,

        // Convenience methods
        runTests: () => {
            TimelineManager.test();
            StepPropertyManager.test();
            SnapshotManager.test();
            PlaybackController.test();
        }
    };

    console.log('[Timeline] Modules initialized successfully');
    console.log('[Timeline] Version:', TIMELINE_VERSION);
    console.log('[Timeline] Feature flags:', TIMELINE_FEATURE_FLAGS);

    return modules;
}

/**
 * Hook for wrapping existing functions safely
 * @param {Object} target - Object containing the function
 * @param {string} methodName - Name of method to wrap
 * @param {Function} afterCallback - Called after original method
 */
function hookAfter(target, methodName, afterCallback) {
    const original = target[methodName];

    if (typeof original !== 'function') {
        console.warn(`[Timeline] Cannot hook ${methodName}: not a function`);
        return;
    }

    target[methodName] = function (...args) {
        // Call original
        const result = original.apply(this, args);

        // Call hook
        try {
            afterCallback.call(this, result, ...args);
        } catch (e) {
            console.error(`[Timeline] Error in hook for ${methodName}:`, e);
        }

        return result;
    };

    // Store reference to original
    target[`_original_${methodName}`] = original;
}

/**
 * Remove a hook and restore original function
 * @param {Object} target - Object containing the function
 * @param {string} methodName - Name of method to restore
 */
function unhook(target, methodName) {
    const original = target[`_original_${methodName}`];

    if (original) {
        target[methodName] = original;
        delete target[`_original_${methodName}`];
    }
}

// Export for CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TIMELINE_FEATURE_FLAGS,
        TIMELINE_VERSION,
        initTimelineModules,
        hookAfter,
        unhook,
        TimelineManager,
        StepPropertyManager,
        SnapshotManager,
        PlaybackController
    };
}
