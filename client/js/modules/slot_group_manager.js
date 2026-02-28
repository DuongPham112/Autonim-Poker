/**
 * SlotGroupManager - Manages layer groups for card place markers
 * 
 * Single source of truth: slotIds[] on each group.
 * No groupId stored on cardPlace — use getGroupForPlace() lookup.
 * 
 * Z-Order formula:
 *   With groups: (group.groupOrder × GROUP_Z_BAND) + place.zOrder
 *   Without groups: place.zOrder (backward compatible)
 */

var GROUP_Z_BAND = 1000;

var GROUP_COLORS = [
    '#4ec9b0', // teal
    '#ce9178', // orange
    '#569cd6', // blue
    '#c586c0', // purple
    '#dcdcaa', // yellow
    '#d16969', // red
    '#6a9955'  // green
];

// ============================================
// LOOKUP FUNCTIONS
// ============================================

/**
 * Find which group a place belongs to by searching slotIds
 * @param {string} placeId - Card place ID
 * @returns {object|null} Group object or null
 */
function getGroupForPlace(placeId) {
    if (!appState || !appState.boardLayout || !appState.boardLayout.slotGroups) return null;
    var groups = appState.boardLayout.slotGroups;
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].slotIds && groups[i].slotIds.indexOf(placeId) >= 0) {
            return groups[i];
        }
    }
    return null;
}

/**
 * Find a place object by its ID from cardPlaces
 * @param {string} placeId - Card place ID
 * @returns {object|null} Place object or null
 */
function findPlaceById(placeId) {
    if (!appState || !appState.boardLayout || !appState.boardLayout.cardPlaces) return null;
    return appState.boardLayout.cardPlaces.find(function (p) { return p.id === placeId; }) || null;
}

// ============================================
// Z-ORDER COMPUTATION
// ============================================

/**
 * Compute final z-order for a card place, taking groups into account
 * If place is in a group: (groupOrder × GROUP_Z_BAND) + place.zOrder
 * If no groups or ungrouped: place.zOrder (backward compat)
 * 
 * @param {object} place - Card place object with zOrder property
 * @returns {number} Final z-order value
 */
function computeFinalZOrder(place) {
    if (!place) return 0;
    var baseZ = place.zOrder || 0;

    var groups = appState && appState.boardLayout && appState.boardLayout.slotGroups;
    if (!groups || groups.length === 0) return baseZ;

    var group = getGroupForPlace(place.id);
    if (!group) return baseZ;

    return (group.groupOrder * GROUP_Z_BAND) + baseZ;
}

/**
 * Compute z-order for a place at a specific step index, accounting for
 * groupOrderOverrides in scenario steps
 * 
 * @param {object} place - Card place object
 * @param {number} stepIndex - Step index to evaluate up to
 * @param {Array} scenarioSteps - Array of scenario steps (optional)
 * @returns {number} Final z-order at that step
 */
function computeFinalZOrderAtStep(place, stepIndex, scenarioSteps) {
    if (!place) return 0;
    var baseZ = place.zOrder || 0;

    var groups = appState && appState.boardLayout && appState.boardLayout.slotGroups;
    if (!groups || groups.length === 0) return baseZ;

    var group = getGroupForPlace(place.id);
    if (!group) return baseZ;

    // Start with current groupOrder
    var effectiveOrder = group.groupOrder;

    // Scan steps for overrides
    if (scenarioSteps) {
        for (var s = 0; s <= stepIndex && s < scenarioSteps.length; s++) {
            var step = scenarioSteps[s];
            if (step.groupOrderOverrides && step.groupOrderOverrides[group.id] !== undefined) {
                effectiveOrder = step.groupOrderOverrides[group.id];
            }
        }
    }

    return (effectiveOrder * GROUP_Z_BAND) + baseZ;
}

/**
 * Compute z-order for a card given its zone/placeId — used by snapshot/export functions
 * Handles grid-zone lookup + group-aware z + CZ zonePosition stacking
 * 
 * @param {object} card - Card object with zone and zonePosition
 * @returns {number} Z-order value to embed in snapshot/export
 */
function computeZOrderForCard(card) {
    var zOrder = 0;
    if (card.zone && card.zone.startsWith('grid-') && appState.boardLayout.cardPlaces) {
        var placeId = card.zone.replace('grid-', '');
        var place = findPlaceById(placeId);
        if (place && place.zOrder !== undefined) {
            zOrder = computeFinalZOrder(place);
            // CZ cards: add zonePosition so later cards stack on top
            if (place.isCommunityZone) {
                zOrder += (card.zonePosition || 0);
            }
        }
    }
    return zOrder;
}

// ============================================
// GROUP CRUD
// ============================================

/**
 * Get group color by index (rotating palette)
 * @param {number} index 
 * @returns {string} CSS color
 */
function getGroupColor(index) {
    return GROUP_COLORS[index % GROUP_COLORS.length];
}

/**
 * Generate unique group ID
 * @returns {string}
 */
function generateGroupId() {
    return 'group-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

/**
 * Create a new slot group from selected slot IDs
 * Removes slots from any existing group first
 * @param {string} name - Group display name
 * @param {Array} slotIds - Array of place IDs to include
 * @returns {object} Created group
 */
function createSlotGroup(name, slotIds) {
    if (!appState.boardLayout.slotGroups) {
        appState.boardLayout.slotGroups = [];
    }

    // Push undo snapshot
    pushGroupUndoSnapshot();

    // Remove these slots from any existing groups
    slotIds.forEach(function (sid) {
        removeSlotFromAllGroups(sid);
    });

    var newGroup = {
        id: generateGroupId(),
        name: name,
        slotIds: slotIds.slice(), // clone
        groupOrder: appState.boardLayout.slotGroups.length,
        color: getGroupColor(appState.boardLayout.slotGroups.length)
    };

    appState.boardLayout.slotGroups.push(newGroup);
    renormalizeGroupOrder();

    debugLog('[SlotGroup] Created "' + name + '" with ' + slotIds.length + ' slots');
    return newGroup;
}

/**
 * Delete a slot group — slots become ungrouped
 * @param {string} groupId
 */
function deleteSlotGroup(groupId) {
    if (!appState.boardLayout.slotGroups) return;

    pushGroupUndoSnapshot();

    var idx = appState.boardLayout.slotGroups.findIndex(function (g) { return g.id === groupId; });
    if (idx < 0) return;

    appState.boardLayout.slotGroups.splice(idx, 1);
    renormalizeGroupOrder();

    debugLog('[SlotGroup] Deleted group "' + groupId + '"');
}

/**
 * Rename a slot group
 * @param {string} groupId
 * @param {string} newName
 */
function renameSlotGroup(groupId, newName) {
    if (!appState.boardLayout.slotGroups) return;
    var group = appState.boardLayout.slotGroups.find(function (g) { return g.id === groupId; });
    if (group) {
        group.name = newName;
        debugLog('[SlotGroup] Renamed "' + groupId + '" → "' + newName + '"');
    }
}

/**
 * Reorder groups via splice (remove + insert at target)
 * Like Photoshop layer drag-to-reorder
 * @param {number} fromIndex - Current index in slotGroups array
 * @param {number} toIndex - Target index
 */
function reorderSlotGroups(fromIndex, toIndex) {
    if (!appState.boardLayout.slotGroups) return;
    var groups = appState.boardLayout.slotGroups;
    if (fromIndex < 0 || fromIndex >= groups.length) return;
    if (toIndex < 0 || toIndex >= groups.length) return;
    if (fromIndex === toIndex) return;

    pushGroupUndoSnapshot();

    // Splice: remove from old position, insert at new
    var moved = groups.splice(fromIndex, 1)[0];
    groups.splice(toIndex, 0, moved);

    renormalizeGroupOrder();
    debugLog('[SlotGroup] Reordered: ' + fromIndex + ' → ' + toIndex);
}

/**
 * Clear all groups (used when switching layouts)
 */
function clearAllGroups() {
    if (appState.boardLayout) {
        appState.boardLayout.slotGroups = [];
    }
    debugLog('[SlotGroup] All groups cleared');
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Remove a slot ID from all groups
 * @param {string} slotId
 */
function removeSlotFromAllGroups(slotId) {
    if (!appState.boardLayout.slotGroups) return;
    appState.boardLayout.slotGroups.forEach(function (group) {
        var idx = group.slotIds.indexOf(slotId);
        if (idx >= 0) {
            group.slotIds.splice(idx, 1);
        }
    });
}

/**
 * Renormalize groupOrder to be sequential (0, 1, 2, ...)
 * Called after any add/delete/reorder
 */
function renormalizeGroupOrder() {
    if (!appState.boardLayout.slotGroups) return;
    appState.boardLayout.slotGroups.forEach(function (group, i) {
        group.groupOrder = i;
    });
}

// ============================================
// UNDO SUPPORT
// ============================================

/**
 * Push a snapshot of current slotGroups for undo
 */
function pushGroupUndoSnapshot() {
    if (!appState.groupUndoStack) {
        appState.groupUndoStack = [];
    }
    var snapshot = JSON.parse(JSON.stringify(appState.boardLayout.slotGroups || []));
    appState.groupUndoStack.push(snapshot);
    if (appState.groupUndoStack.length > 30) {
        appState.groupUndoStack.shift();
    }
}

/**
 * Undo last group operation
 * @returns {boolean} true if undo was performed
 */
function undoGroupAction() {
    if (!appState.groupUndoStack || appState.groupUndoStack.length === 0) {
        return false;
    }
    appState.boardLayout.slotGroups = appState.groupUndoStack.pop();
    debugLog('[SlotGroup] Undo performed, ' + appState.groupUndoStack.length + ' remaining');
    return true;
}
