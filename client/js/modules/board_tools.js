/**
 * Board Tools Module — Align, Distribute, Stack, Pusoy Pack, Cloner
 * Used in board-setting phase for advanced slot manipulation.
 * 
 * Dependencies: appState, renderCardPlaceMarkers, updateCardPlacesList, 
 *   updateGroupPanelVisibility, getGroupColor, debugLog, setStatus (from main.js)
 */

// ============================================
// ALIGN TOOLS
// ============================================

/**
 * Arrange selected slots in a horizontal row (same Y, even X spacing)
 * Uses spacing from the arrangeSpacing slider
 */
function arrangeRow() {
    const places = getActivePlaces();
    if (places.length < 2) {
        setStatus('Select 2+ slots to arrange');
        return;
    }

    pushBoardUndoSnapshot();

    // Get spacing from slider (default 80)
    const spacingSlider = document.getElementById('arrangeSpacing');
    const spacing = spacingSlider ? parseInt(spacingSlider.value) : 80;

    // Calculate average Y position (center line of the row)
    const avgY = Math.round(places.reduce((sum, p) => sum + p.y, 0) / places.length);

    // Sort by current X to maintain left-to-right order
    places.sort((a, b) => a.x - b.x);

    // Calculate total width and center the row around the average X
    const avgX = Math.round(places.reduce((sum, p) => sum + p.x, 0) / places.length);
    const totalWidth = (places.length - 1) * spacing;
    const startX = Math.round(avgX - totalWidth / 2);

    places.forEach((p, i) => {
        p.x = startX + i * spacing;
        p.y = avgY;
    });

    renderCardPlaceMarkers();
    updateCardPlacesList();
    debugLog(`[Arrange] Row: ${places.length} places, spacing=${spacing}`);
    setStatus(`Arranged ${places.length} slots in a row (spacing: ${spacing}px)`);
}

/**
 * Arrange selected slots in a vertical column (same X, even Y spacing)
 * Uses spacing from the arrangeSpacing slider
 */
function arrangeColumn() {
    const places = getActivePlaces();
    if (places.length < 2) {
        setStatus('Select 2+ slots to arrange');
        return;
    }

    pushBoardUndoSnapshot();

    // Get spacing from slider (default 80)
    const spacingSlider = document.getElementById('arrangeSpacing');
    const spacing = spacingSlider ? parseInt(spacingSlider.value) : 80;

    // Calculate average X position (center line of the column)
    const avgX = Math.round(places.reduce((sum, p) => sum + p.x, 0) / places.length);

    // Sort by current Y to maintain top-to-bottom order
    places.sort((a, b) => a.y - b.y);

    // Calculate total height and center the column around the average Y
    const avgY = Math.round(places.reduce((sum, p) => sum + p.y, 0) / places.length);
    const totalHeight = (places.length - 1) * spacing;
    const startY = Math.round(avgY - totalHeight / 2);

    places.forEach((p, i) => {
        p.x = avgX;
        p.y = startY + i * spacing;
    });

    renderCardPlaceMarkers();
    updateCardPlacesList();
    debugLog(`[Arrange] Column: ${places.length} places, spacing=${spacing}`);
    setStatus(`Arranged ${places.length} slots in a column (spacing: ${spacing}px)`);
}

/**
 * Stack slots with overlap (right-to-left layering)
 * Last slot (rightmost) gets highest z-order = visually on top
 * @param {number} overlap - Overlap amount in UI pixels (default: card width * 0.7 ≈ 50px)
 */
function stackSlots(overlap) {
    const places = getActivePlaces();
    if (places.length < 2) {
        setStatus('Select 2+ slots to stack');
        return;
    }

    pushBoardUndoSnapshot();

    overlap = overlap || 50;

    // Sort by current X position to maintain order
    places.sort((a, b) => a.x - b.x);

    // Use first slot position as anchor
    const anchorX = places[0].x;
    const anchorY = places[0].y;

    places.forEach((p, i) => {
        p.x = Math.round(anchorX + i * overlap);
        p.y = anchorY; // Same Y for all
        // Right-to-left z-order: rightmost card on top
        p.zOrder = i;
    });

    renderCardPlaceMarkers();
    updateCardPlacesList();
    debugLog(`[Stack] ${places.length} places with overlap=${overlap}`);
    setStatus(`Stacked ${places.length} slots (overlap: ${overlap}px)`);
}

// ============================================
// PUSOY PACK
// ============================================

/**
 * Preset positions for Pusoy packs (like 4-player poker zones)
 * Pack 0 (initial): center-top
 * Pack 1: center-bottom
 * Pack 2: left
 * Pack 3: right
 */
const PUSOY_PACK_POSITIONS = [
    { label: 'Bottom', cx: 640, cy: 590, orient: 0, packPrefix: 'p1' },
    { label: 'Left', cx: 640, cy: 280, orient: 0, packPrefix: 'p2' },
    { label: 'Top', cx: 640, cy: 130, orient: 0, packPrefix: 'p0' },
    { label: 'Right', cx: 640, cy: 430, orient: 0, packPrefix: 'p3' }
];

/**
 * Add a Pusoy Pack (13 cards in 3-5-5 fan formation)
 * First call creates at center-top, subsequent calls fill the 4 corners
 */
function handleAddPusoyPack() {
    // Count existing Pusoy packs
    const existingPacks = (appState.boardLayout.slotGroups || [])
        .filter(g => g.id.match(/^pusoy-(p\d)-(hand|-top)/));
    const packIndex = existingPacks.length;

    if (packIndex >= PUSOY_PACK_POSITIONS.length) {
        setStatus('Maximum 4 Pusoy packs reached');
        return;
    }

    pushBoardUndoSnapshot();

    const pos = PUSOY_PACK_POSITIONS[packIndex];

    // Read slider values for fan parameters
    const spacingSlider = document.getElementById('pusoySpacing');
    const curvatureSlider = document.getElementById('pusoyCurvature');
    const layerGapSlider = document.getElementById('pusoyLayerGap');

    const baseSpacing = spacingSlider ? parseInt(spacingSlider.value) : 150;
    const curvature = curvatureSlider ? parseInt(curvatureSlider.value) : 50;
    const layerGap = layerGapSlider ? parseInt(layerGapSlider.value) : 30;

    const hand = generatePusoyHand(
        pos.packPrefix, pos.cx, pos.cy, pos.orient, 1,
        packIndex * 100, baseSpacing, curvature, layerGap
    );

    appState.boardLayout.cardPlaces.push(...hand);

    appState.boardLayout.slotGroups.push({
        id: `pusoy-${pos.packPrefix}-hand`,
        name: pos.label,
        slotIds: hand.map(h => h.id),
        groupOrder: packIndex,
        color: getGroupColor(packIndex)
    });

    renderCardPlaceMarkers();
    updateCardPlacesList();
    if (typeof updateGroupPanelVisibility === 'function') updateGroupPanelVisibility();

    debugLog(`[PusoyPack] Added pack #${packIndex} (${pos.label}) with ${hand.length} slots`);
    setStatus(`Added Pusoy Pack: ${pos.label} (${hand.length} cards)`);
}

// ============================================
// CLONER TOOL
// ============================================

/**
 * Cloner state
 */
const clonerState = {
    active: false,
    editingGroupId: null,  // If editing existing cloner group
    mode: 'linear-h',     // 'linear-h' | 'linear-v' | 'arc'
    sourcePlace: null,     // Reference to source place object (for live drag sync)
    sourceX: 640,
    sourceY: 360,
    count: 5,
    spacing: 80,
    rotation: 0,          // Rotation for all cloned slots (degrees)
    arcRadius: 200,
    arcSpread: 90,
    previewPlaces: []      // Ghost preview markers
};

/**
 * Start Cloner from a selected place or from center
 * @param {object|null} sourcePlace - Source slot position (or null for center)
 */
function startCloner(sourcePlace) {
    clonerState.active = true;
    clonerState.editingGroupId = null;
    clonerState.sourcePlace = sourcePlace || null;
    clonerState.sourceX = sourcePlace ? sourcePlace.x : 640;
    clonerState.sourceY = sourcePlace ? sourcePlace.y : 360;

    updateClonerPreview();
    showClonerPanel();
    debugLog(`[Cloner] Started at (${clonerState.sourceX}, ${clonerState.sourceY})`);
}

/**
 * Edit an existing cloner group
 * @param {string} groupId - Cloner group ID
 */
function editCloner(groupId) {
    const group = (appState.boardLayout.slotGroups || []).find(g => g.id === groupId);
    if (!group || !group.clonerConfig) {
        setStatus('Not a cloner group');
        return;
    }

    clonerState.active = true;
    clonerState.editingGroupId = groupId;
    clonerState.mode = group.clonerConfig.mode;
    clonerState.sourceX = group.clonerConfig.sourceX;
    clonerState.sourceY = group.clonerConfig.sourceY;
    clonerState.count = group.clonerConfig.count;
    clonerState.spacing = group.clonerConfig.spacing;
    clonerState.rotation = group.clonerConfig.rotation || 0;
    clonerState.arcRadius = group.clonerConfig.arcRadius || 200;
    clonerState.arcSpread = group.clonerConfig.arcSpread || 90;

    // Restore sourcePlace reference from the first slot (seed) in the group
    if (group.slotIds && group.slotIds.length > 0) {
        const seedId = group.slotIds[0];
        clonerState.sourcePlace = appState.boardLayout.cardPlaces.find(p => p.id === seedId) || null;
    } else {
        clonerState.sourcePlace = null;
    }

    // Update UI controls
    const panel = document.getElementById('clonerPanel');
    if (panel) {
        const modeSelect = document.getElementById('clonerMode');
        if (modeSelect) modeSelect.value = clonerState.mode;
        const countSlider = document.getElementById('clonerCount');
        if (countSlider) { countSlider.value = clonerState.count; }
        const countValue = document.getElementById('clonerCountValue');
        if (countValue) countValue.textContent = clonerState.count;
        const spacingSlider = document.getElementById('clonerSpacing');
        if (spacingSlider) { spacingSlider.value = clonerState.spacing; }
        const spacingValue = document.getElementById('clonerSpacingValue');
        if (spacingValue) spacingValue.textContent = clonerState.spacing;
        const rotationSlider = document.getElementById('clonerRotation');
        if (rotationSlider) { rotationSlider.value = clonerState.rotation; }
        const rotationValue = document.getElementById('clonerRotationValue');
        if (rotationValue) rotationValue.textContent = clonerState.rotation + '°';
        const radiusSlider = document.getElementById('clonerArcRadius');
        if (radiusSlider) { radiusSlider.value = clonerState.arcRadius; }
        const radiusValue = document.getElementById('clonerArcRadiusValue');
        if (radiusValue) radiusValue.textContent = clonerState.arcRadius;
        const spreadSlider = document.getElementById('clonerArcSpread');
        if (spreadSlider) { spreadSlider.value = clonerState.arcSpread; }
        const spreadValue = document.getElementById('clonerArcSpreadValue');
        if (spreadValue) spreadValue.textContent = clonerState.arcSpread + '°';
        // Show/hide arc controls based on mode
        const arcControls = document.getElementById('clonerArcControls');
        if (arcControls) arcControls.classList.toggle('hidden', clonerState.mode !== 'arc');
    }

    updateClonerPreview();
    showClonerPanel();
    debugLog(`[Cloner] Editing group ${groupId}, seed=${clonerState.sourcePlace ? clonerState.sourcePlace.id : 'none'}`);
    setStatus(`Editing cloner: ${group.name}`);
}

/**
 * Generate positions based on current cloner state
 * @returns {Array} Array of {x, y, rotation} objects
 */
function generateClonerPositions() {
    const positions = [];
    // Use live position from sourcePlace reference if available
    const sourceX = clonerState.sourcePlace ? clonerState.sourcePlace.x : clonerState.sourceX;
    const sourceY = clonerState.sourcePlace ? clonerState.sourcePlace.y : clonerState.sourceY;
    const { count, spacing, mode, rotation, arcRadius, arcSpread } = clonerState;

    for (let i = 0; i < count; i++) {
        if (mode === 'linear-h') {
            positions.push({
                x: Math.round(sourceX + i * spacing),
                y: sourceY,
                rotation: rotation
            });
        } else if (mode === 'linear-v') {
            positions.push({
                x: sourceX,
                y: Math.round(sourceY + i * spacing),
                rotation: rotation
            });
        } else if (mode === 'arc') {
            const spreadRad = (arcSpread * Math.PI) / 180;
            const startAngle = -spreadRad / 2;
            const angleStep = count > 1 ? spreadRad / (count - 1) : 0;
            const angle = startAngle + (i * angleStep);

            positions.push({
                x: Math.round(sourceX + arcRadius * Math.sin(angle)),
                y: Math.round(sourceY - arcRadius * Math.cos(angle)),
                rotation: Math.round((angle * 180) / Math.PI) + rotation
            });
        }
    }

    return positions;
}

/**
 * Update cloner preview (ghost markers)
 */
function updateClonerPreview() {
    // Remove existing preview markers
    document.querySelectorAll('.cloner-preview-marker').forEach(el => el.remove());

    if (!clonerState.active) return;

    const positions = generateClonerPositions();

    // Use same coordinate system as renderCardPlaceMarkers() in main.js
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) return;
    const tableRect = pokerTable.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();
    const scaleX = pokerTable.offsetWidth / UI_WIDTH;
    const scaleY = pokerTable.offsetHeight / UI_HEIGHT;
    const offsetX = tableRect.left - containerRect.left;
    const offsetY = tableRect.top - containerRect.top;

    positions.forEach((pos, i) => {
        const ghost = document.createElement('div');
        ghost.className = 'card-place-marker cloner-preview-marker';
        ghost.style.left = (pos.x * scaleX + offsetX) + 'px';
        ghost.style.top = (pos.y * scaleY + offsetY) + 'px';
        ghost.style.transform = `translate(-50%, -50%) rotate(${pos.rotation}deg)`;
        ghost.innerHTML = `<span class="marker-label">${i + 1}</span>`;
        gameContainer.appendChild(ghost);
    });

    clonerState.previewPlaces = positions;
}

/**
 * Apply cloner — create actual slots from preview
 */
function applyCloner() {
    if (!clonerState.active) return;

    const positions = generateClonerPositions();
    if (positions.length === 0) return;

    pushBoardUndoSnapshot();

    const clonerId = 'cloner-' + Date.now().toString(36);

    // If editing, remove old slots first
    if (clonerState.editingGroupId) {
        const oldGroup = appState.boardLayout.slotGroups.find(g => g.id === clonerState.editingGroupId);
        if (oldGroup) {
            appState.boardLayout.cardPlaces = appState.boardLayout.cardPlaces.filter(
                p => !oldGroup.slotIds.includes(p.id)
            );
            appState.boardLayout.slotGroups = appState.boardLayout.slotGroups.filter(
                g => g.id !== clonerState.editingGroupId
            );
        }
    }

    // Create new slots — source card becomes position[0], new slots for the rest
    const baseZOrder = Math.max(0, ...appState.boardLayout.cardPlaces.map(p => p.zOrder || 0)) + 1;
    const allSlotIds = [];

    // Move the source card to position[0] if it exists
    const sourcePlace = clonerState.sourcePlace;
    if (sourcePlace && positions.length > 0) {
        sourcePlace.x = positions[0].x;
        sourcePlace.y = positions[0].y;
        sourcePlace.rotation = positions[0].rotation;
        sourcePlace.zOrder = baseZOrder;
        sourcePlace.clonerId = clonerId;
        allSlotIds.push(sourcePlace.id);
        // Re-add sourcePlace to cardPlaces if it was removed during re-edit
        if (!appState.boardLayout.cardPlaces.includes(sourcePlace)) {
            appState.boardLayout.cardPlaces.push(sourcePlace);
        }
    }

    // Create new slots for positions[1..N-1] (or all if no source)
    const startIdx = sourcePlace ? 1 : 0;
    const newPlaces = [];
    for (let i = startIdx; i < positions.length; i++) {
        const newPlace = {
            id: `${clonerId}-${i}`,
            x: positions[i].x,
            y: positions[i].y,
            rotation: positions[i].rotation,
            zOrder: baseZOrder + i,
            label: String(appState.boardLayout.cardPlaces.length + newPlaces.length + 1),
            clonerId: clonerId
        };
        newPlaces.push(newPlace);
        allSlotIds.push(newPlace.id);
    }

    // Create cloner group (using slotGroups infrastructure)
    const groupOrder = appState.boardLayout.slotGroups.length;
    const clonerGroup = {
        id: clonerId,
        name: `Cloner (${clonerState.mode}, ${allSlotIds.length})`,
        slotIds: allSlotIds,
        groupOrder: groupOrder,
        color: getGroupColor(groupOrder),
        clonerConfig: {
            mode: clonerState.mode,
            sourceX: positions[0].x,
            sourceY: positions[0].y,
            count: clonerState.count,
            spacing: clonerState.spacing,
            rotation: clonerState.rotation,
            arcRadius: clonerState.arcRadius,
            arcSpread: clonerState.arcSpread
        }
    };

    // Append to board
    appState.boardLayout.cardPlaces.push(...newPlaces);
    appState.boardLayout.slotGroups.push(clonerGroup);

    // Cleanup
    cancelCloner();
    renderCardPlaceMarkers();
    updateCardPlacesList();
    updateGroupPanelVisibility();

    debugLog(`[Cloner] Applied ${allSlotIds.length} slots (${clonerState.mode}), source=${sourcePlace ? sourcePlace.id : 'none'}`);
    setStatus(`Cloner created: ${allSlotIds.length} slots`);
}

/**
 * Cancel cloner — remove previews
 */
function cancelCloner() {
    clonerState.active = false;
    clonerState.editingGroupId = null;
    clonerState.sourcePlace = null;
    clonerState.previewPlaces = [];
    document.querySelectorAll('.cloner-preview-marker').forEach(el => el.remove());
    hideClonerPanel();
}

/**
 * Delete a cloner group and all its slots
 * @param {string} groupId - Cloner group ID
 */
function deleteClonerGroup(groupId) {
    const group = appState.boardLayout.slotGroups.find(g => g.id === groupId);
    if (!group) return;

    pushBoardUndoSnapshot();

    // Remove slots
    appState.boardLayout.cardPlaces = appState.boardLayout.cardPlaces.filter(
        p => !group.slotIds.includes(p.id)
    );

    // Remove group
    appState.boardLayout.slotGroups = appState.boardLayout.slotGroups.filter(
        g => g.id !== groupId
    );

    renderCardPlaceMarkers();
    updateCardPlacesList();
    updateGroupPanelVisibility();
    setStatus(`Deleted cloner group: ${group.name}`);
}

/**
 * Show/hide cloner panel
 */
function showClonerPanel() {
    const panel = document.getElementById('clonerPanel');
    if (panel) panel.classList.remove('hidden');
}

function hideClonerPanel() {
    const panel = document.getElementById('clonerPanel');
    if (panel) panel.classList.add('hidden');
}

// ============================================
// HELPERS
// ============================================

/**
 * Get currently selected places (multi-select or single)
 * @returns {Array} Selected place objects
 */
function getActivePlaces() {
    if (appState.selectedCardPlaces && appState.selectedCardPlaces.length > 0) {
        return appState.selectedCardPlaces;
    }
    if (appState.selectedCardPlace) {
        return [appState.selectedCardPlace];
    }
    return [];
}

/**
 * Push a full board state snapshot for undo
 */
function pushBoardUndoSnapshot() {
    appState.markerUndoStack.push({
        type: 'delete', // Reuse delete undo type since it restores full state
        cardPlaces: JSON.parse(JSON.stringify(appState.boardLayout.cardPlaces)),
        slotGroups: JSON.parse(JSON.stringify(appState.boardLayout.slotGroups || []))
    });
}

/**
 * Initialize board tools event listeners
 * Called from bindEvents() in main.js
 */
function initBoardTools() {
    // Arrange Row button
    const arrangeRowBtn = document.getElementById('arrangeRowBtn');
    if (arrangeRowBtn) {
        arrangeRowBtn.addEventListener('click', arrangeRow);
    }

    // Arrange Column button
    const arrangeColBtn = document.getElementById('arrangeColBtn');
    if (arrangeColBtn) {
        arrangeColBtn.addEventListener('click', arrangeColumn);
    }

    // Arrange Spacing slider
    const arrangeSpacing = document.getElementById('arrangeSpacing');
    if (arrangeSpacing) {
        arrangeSpacing.addEventListener('input', (e) => {
            const valueEl = document.getElementById('arrangeSpacingValue');
            if (valueEl) valueEl.textContent = e.target.value;
        });
    }

    // Stack button
    const stackBtn = document.getElementById('stackSlotsBtn');
    if (stackBtn) {
        stackBtn.addEventListener('click', () => stackSlots());
    }

    // Add Pusoy Pack button
    const addPusoyPackBtn = document.getElementById('addPusoyPackBtn');
    if (addPusoyPackBtn) {
        addPusoyPackBtn.addEventListener('click', handleAddPusoyPack);
    }

    // Add Array Pack button
    const addArrayPackBtn = document.getElementById('addArrayPackBtn');
    if (addArrayPackBtn) {
        addArrayPackBtn.addEventListener('click', handleAddArrayPack);
    }

    // Cloner buttons
    const clonerBtn = document.getElementById('clonerBtn');
    if (clonerBtn) {
        clonerBtn.addEventListener('click', () => {
            const source = appState.selectedCardPlace || null;
            if (!source) {
                setStatus('Select a slot first to use Cloner', 'warning');
                return;
            }
            startCloner(source);
        });
    }

    const clonerApplyBtn = document.getElementById('clonerApplyBtn');
    if (clonerApplyBtn) {
        clonerApplyBtn.addEventListener('click', applyCloner);
    }

    const clonerCancelBtn = document.getElementById('clonerCancelBtn');
    if (clonerCancelBtn) {
        clonerCancelBtn.addEventListener('click', cancelCloner);
    }

    // Cloner mode selector
    const clonerModeSelect = document.getElementById('clonerMode');
    if (clonerModeSelect) {
        clonerModeSelect.addEventListener('change', (e) => {
            clonerState.mode = e.target.value;
            // Toggle arc-specific controls visibility
            const arcControls = document.getElementById('clonerArcControls');
            if (arcControls) arcControls.classList.toggle('hidden', clonerState.mode !== 'arc');
            updateClonerPreview();
        });
    }

    // Cloner sliders
    const clonerSliders = ['clonerCount', 'clonerSpacing', 'clonerRotation', 'clonerArcRadius', 'clonerArcSpread'];
    const clonerStateKeys = ['count', 'spacing', 'rotation', 'arcRadius', 'arcSpread'];
    clonerSliders.forEach((id, idx) => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', (e) => {
                clonerState[clonerStateKeys[idx]] = parseInt(e.target.value);
                // Update value display
                const valueEl = document.getElementById(id + 'Value');
                if (valueEl) valueEl.textContent = e.target.value + (id.includes('Spread') || id.includes('Rotation') ? '°' : '');
                updateClonerPreview();
            });
        }
    });

    // Background type selector
    const bgTypeSelect = document.getElementById('bgTypeSelect');
    const bgImageControls = document.getElementById('bgImageControls');
    const bgImageBrowseBtn = document.getElementById('bgImageBrowseBtn');
    const bgImageRemoveBtn = document.getElementById('bgImageRemoveBtn');
    const bgImageFileInput = document.getElementById('bgImageFileInput');
    const bgImagePreview = document.getElementById('bgImagePreview');
    const bgImageThumb = document.getElementById('bgImageThumb');

    if (bgTypeSelect) {
        bgTypeSelect.addEventListener('change', (e) => {
            const pokerTable = document.getElementById('pokerTable');
            if (!pokerTable) return;

            const type = e.target.value;
            // Show/hide image controls
            if (bgImageControls) {
                bgImageControls.classList.toggle('hidden', type !== 'image');
            }

            switch (type) {
                case 'poker':
                    pokerTable.style.display = '';
                    gameContainer.style.background = '';
                    gameContainer.style.backgroundImage = '';
                    break;
                case 'solid':
                    pokerTable.style.display = 'none';
                    gameContainer.style.background = '#1a1a2e';
                    gameContainer.style.backgroundImage = '';
                    break;
                case 'image':
                    pokerTable.style.display = 'none';
                    // Restore existing image if available
                    if (appState.boardLayout.backgroundImage) {
                        applyBgImage(appState.boardLayout.backgroundImage);
                    } else {
                        gameContainer.style.background = '#1a1a2e';
                    }
                    break;
            }
            debugLog(`[Board] Background changed to: ${type}`);
        });
    }

    // Browse button → trigger file input
    if (bgImageBrowseBtn && bgImageFileInput) {
        bgImageBrowseBtn.addEventListener('click', () => {
            bgImageFileInput.click();
        });
    }

    // File input → read image as data URL
    if (bgImageFileInput) {
        bgImageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                // Save to state
                appState.boardLayout.backgroundImage = dataUrl;
                // Apply
                applyBgImage(dataUrl);
                // Show preview + remove button
                if (bgImageThumb) bgImageThumb.src = dataUrl;
                if (bgImagePreview) bgImagePreview.classList.remove('hidden');
                if (bgImageRemoveBtn) bgImageRemoveBtn.classList.remove('hidden');
                setStatus('Background image applied');
                debugLog('[Board] Custom background image set');
            };
            reader.readAsDataURL(file);
            // Reset file input so same file can be re-selected
            bgImageFileInput.value = '';
        });
    }

    // Remove button → clear background image
    if (bgImageRemoveBtn) {
        bgImageRemoveBtn.addEventListener('click', () => {
            appState.boardLayout.backgroundImage = null;
            gameContainer.style.background = '#1a1a2e';
            gameContainer.style.backgroundImage = '';
            if (bgImagePreview) bgImagePreview.classList.add('hidden');
            if (bgImageThumb) bgImageThumb.src = '';
            bgImageRemoveBtn.classList.add('hidden');
            setStatus('Background image removed');
            debugLog('[Board] Custom background image removed');
        });
    }

    /**
     * Apply a data URL as the game container background
     */
    function applyBgImage(dataUrl) {
        gameContainer.style.background = `url("${dataUrl}") center/cover no-repeat`;
        // Show preview + remove if controls exist
        if (bgImageThumb) bgImageThumb.src = dataUrl;
        if (bgImagePreview) bgImagePreview.classList.remove('hidden');
        if (bgImageRemoveBtn) bgImageRemoveBtn.classList.remove('hidden');
    }
}

const ARRAY_PACK_ZONES = ['bottom', 'left', 'top', 'right'];

function handleAddArrayPack() {
    const existingPacks = (appState.boardLayout.slotGroups || []).filter(g => g.id.startsWith('array-'));
    const existingZoneNames = existingPacks.map(g => g.id.replace('array-', ''));
    
    let zoneName = null;
    let packIndex = -1;
    for (let i = 0; i < ARRAY_PACK_ZONES.length; i++) {
        if (!existingZoneNames.includes(ARRAY_PACK_ZONES[i])) {
            zoneName = ARRAY_PACK_ZONES[i];
            packIndex = i;
            break;
        }
    }
    
    if (packIndex === -1) {
        setStatus('Maximum 4 Array packs reached');
        return;
    }

    if (typeof pushBoardUndoSnapshot === 'function') pushBoardUndoSnapshot();
    if (typeof generateArrayHand === 'function') {
        const newPack = generateArrayHand(zoneName, packIndex);
        if (!appState.boardLayout.cardPlaces) appState.boardLayout.cardPlaces = [];
        if (!appState.boardLayout.slotGroups) appState.boardLayout.slotGroups = [];
        
        appState.boardLayout.cardPlaces.push(...newPack.places);
        appState.boardLayout.slotGroups.push(newPack.group);
        
        updateUI();
        if (typeof renderCardDropZones === 'function') renderCardDropZones();
        if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
        setStatus('Added Array pack: ' + zoneName);
    }
}
