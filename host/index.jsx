/**
 * ============================================
 * AUTONIM-POKER - ExtendScript for After Effects
 * Director Tool Animation Generator v2.0
 * ============================================
 * 
 * This script processes JSON scenario data from the Director Tool
 * and generates animated compositions in After Effects.
 * 
 * v2.0 Features:
 * - Card Pre-Comps (Front + Back layers)
 * - Flip Animation (Scale X + Opacity Toggle)
 * - Slam Effect (Overshoot bounce)
 */

// ============================================
// JSON POLYFILL FOR OLDER EXTENDSCRIPT
// ============================================

if (typeof JSON === 'undefined') {
    JSON = {};
}

if (typeof JSON.parse !== 'function') {
    JSON.parse = function (text) {
        return eval('(' + text + ')');
    };
}

if (typeof JSON.stringify !== 'function') {
    JSON.stringify = function (obj) {
        var t = typeof obj;
        if (t !== "object" || obj === null) {
            if (t === "string") return '"' + obj.replace(/"/g, '\\"') + '"';
            return String(obj);
        } else {
            var n, v, json = [], arr = (obj && obj.constructor === Array);
            for (n in obj) {
                if (obj.hasOwnProperty(n)) {
                    v = obj[n];
                    t = typeof v;
                    if (t === "string") v = '"' + v.replace(/"/g, '\\"') + '"';
                    else if (t === "object" && v !== null) v = JSON.stringify(v);
                    json.push((arr ? "" : '"' + n + '":') + String(v));
                }
            }
            return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
        }
    };
}

// ============================================
// CONSTANTS
// ============================================

var COMP_WIDTH = 1920;
var COMP_HEIGHT = 1080;
var FRAME_RATE = 30;
var CARD_WIDTH = 80;    // Base width
var CARD_HEIGHT = 112;  // Base height
var SLAM_OVERSHOOT_SCALE = 130;  // 130% of original
var SLAM_DURATION_FRAMES = 5;    // 5 frames for slam bounce
var MOVE_DURATION_FRAMES = 10;   // 10 frames (~0.33s) for position animation
var FLIP_DURATION_FRAMES = 5;    // 5 frames (~0.17s) for rotation/flip animation
var Z_SPACING = 10;              // Z spacing between cards (3D ordering)
var INITIAL_Z_OFFSET = 0;        // Initial Z position for all cards

// Zone center positions for poker layout (1920x1080)
var ZONE_CENTERS = {
    top: { x: 960, y: 120 },
    bottom: { x: 960, y: 960 },
    left: { x: 120, y: 540 },
    right: { x: 1800, y: 540 },
    community: { x: 960, y: 540 }
};

// Folder organization
var FOLDER_CARD_IMG = "Card_IMG";
var FOLDER_COMP = "Comp";

// Session tracking for unique naming
var sessionFolders = {}; // Store created folder references for current session

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Generate animation sequence from JSON scenario data
 * @param {string} jsonString - JSON string containing scenario data
 * @param {string} assetsRootPath - Root path for assets folder
 * @returns {string} JSON result with success/error info
 */
function generateSequence(jsonString, assetsRootPath) {
    try {
        // Parse JSON data
        var data = JSON.parse(jsonString);

        // Validate required fields
        if (!data.projectInfo) {
            data.projectInfo = { width: COMP_WIDTH, height: COMP_HEIGHT, fps: FRAME_RATE };
        }
        if (!data.initialState) {
            return createErrorResponse("Missing initialState in JSON data");
        }
        if (!data.scenario || data.scenario.length === 0) {
            return createErrorResponse("Missing or empty scenario in JSON data");
        }

        // Normalize assets root path
        assetsRootPath = normalizeAssetPath(assetsRootPath);

        // Start undo group
        app.beginUndoGroup("Autonim-Poker: Generate Sequence");

        // Setup folder organization
        // Get board type from data (default to 'poker')
        var boardType = data.boardType || "poker";
        var folderInfo = setupProjectFolders(boardType);

        // Store folder info for use in other functions
        sessionFolders = folderInfo;

        // Calculate total duration from scenario
        var totalDuration = calculateTotalDuration(data.scenario);
        totalDuration = Math.max(totalDuration + 0.5, 2.0); // Add buffer, minimum 2 seconds

        // Create new composition with organized naming
        // Name format: PokerBoard_01, GridBoard_01, etc.
        var boardTypeName = boardType.charAt(0).toUpperCase() + boardType.slice(1);
        var compName = boardTypeName + "Board_" + folderInfo.sessionId.split("_")[1];

        var comp = app.project.items.addComp(
            compName,
            data.projectInfo.width || COMP_WIDTH,
            data.projectInfo.height || COMP_HEIGHT,
            1.0,  // Pixel aspect ratio
            totalDuration,
            data.projectInfo.fps || FRAME_RATE
        );

        // Main comp stays at root (not in folder) for easy access

        // Store layer references by ID
        var layerMap = {};

        // Setup initial scene state (Create Pre-Comps in organized folders)
        var setupResult = setupInitialScene(comp, data.initialState, assetsRootPath, layerMap, folderInfo);
        if (!setupResult.success) {
            app.endUndoGroup();
            return createErrorResponse(setupResult.message);
        }

        // Note: Using layer stack ordering (moveToBeginning) instead of 3D camera

        // Process scenario animation steps
        var stepBlending = data.stepBlending || 0;  // Overlap % (0-50)
        var animResult = processScenarioAnimation(comp, data.scenario, layerMap, stepBlending);
        if (!animResult.success) {
            app.endUndoGroup();
            return createErrorResponse(animResult.message);
        }

        // Create Control Layer with Expression Control sliders
        var controlLayer = createControlLayer(comp);
        var controlLayerName = controlLayer.name;

        // Apply expressions to card layers
        for (var cardId in layerMap) {
            if (layerMap.hasOwnProperty(cardId)) {
                var layer = layerMap[cardId];
                var cardInfo = data.initialState[cardId];

                // Apply Scale expression (links to Card Scale slider)
                applyScaleExpression(layer, controlLayerName);

                // Apply Zone Offset expression if card is in a zone
                if (cardInfo && cardInfo.zone) {
                    applyZoneOffsetExpression(layer, controlLayerName, cardInfo.zone);
                }
            }
        }

        // Cleanup: Set work area to actual duration
        var actualDuration = animResult.finalTime + 0.3; // Small buffer at end
        comp.workAreaStart = 0;
        comp.workAreaDuration = actualDuration;

        // Open composition for user
        comp.openInViewer();

        // End undo group
        app.endUndoGroup();

        // Return success
        return createSuccessResponse(
            "Created composition '" + compName + "' with " +
            data.scenario.length + " steps and " +
            Object.keys(layerMap).length + " layers",
            compName
        );

    } catch (error) {
        app.endUndoGroup();
        return createErrorResponse("Script error: " + error.toString());
    }
}

// ============================================
// SCENE SETUP (Initial State)
// ============================================

/**
 * Setup initial scene from initialState data
 * Uses Pre-Comps for each card to support Flip animation
 * @param {CompItem} comp - The composition to add layers to
 * @param {object} initialState - Initial state data from JSON
 * @param {string} assetsRootPath - Root path for assets
 * @param {object} layerMap - Object to store layer references by ID
 * @param {object} folderInfo - Folder organization info
 * @returns {object} Result with success status
 */
function setupInitialScene(comp, initialState, assetsRootPath, layerMap, folderInfo) {
    var importErrors = [];

    // Collect asset IDs with their zOrder for sorting
    // zOrder comes from Pusoy layout, fallback to zonePosition for other layouts
    var assetArray = [];
    for (var assetId in initialState) {
        if (initialState.hasOwnProperty(assetId)) {
            var assetInfo = initialState[assetId];
            // Prioritize zOrder (from grid layouts like Pusoy), fallback to zonePosition
            var sortOrder = assetInfo.zOrder !== undefined ? assetInfo.zOrder :
                (assetInfo.zonePosition || 0);
            assetArray.push({
                id: assetId,
                zOrder: sortOrder
            });
        }
    }

    // Sort by zOrder ASCENDING
    // Cards with lower zOrder are added FIRST → end up at BOTTOM of layer stack (behind)
    // Cards with higher zOrder are added LAST → end up on TOP of layer stack (in front)
    assetArray.sort(function (a, b) {
        return a.zOrder - b.zOrder;
    });


    for (var i = 0; i < assetArray.length; i++) {
        var assetId = assetArray[i].id;
        var assetInfo = initialState[assetId];
        var layer = null;

        try {
            // Create Pre-Comp for this card (contains Front and Back layers)
            layer = createCardPrecomp(comp, assetId, assetInfo, assetsRootPath, folderInfo);

            if (!layer) {
                importErrors.push(assetId + " (failed to create pre-comp)");
                continue;
            }

            // Apply initial transform properties to the Pre-Comp Layer in Main Comp
            applyInitialTransform(layer, assetInfo, comp);

            // Store reference in layer map
            layerMap[assetId] = layer;

        } catch (e) {
            importErrors.push(assetId + " (" + e.toString() + ")");
        }
    }

    if (importErrors.length > 0) {
        $.writeln("Import warnings: " + importErrors.join(", "));
    }

    return { success: true, message: "Setup complete" };
}

/**
 * Create a Pre-Composition for a card containing Front and Back layers
 * @param {CompItem} mainComp - Main composition
 * @param {string} cardId - Unique Card ID
 * @param {object} cardInfo - Card info structure
 * @param {string} assetsPath - Assets root path
 * @param {object} folderInfo - Folder organization info
 * @returns {Layer} The layer instance of the pre-comp in the main comp
 */
function createCardPrecomp(mainComp, cardId, cardInfo, assetsPath, folderInfo) {
    // 1. Create the Pre-Comp
    var preCompName = "Card_" + cardInfo.name + "_" + cardId.split("-")[1]; // Add index to name unique
    var cardWidth = CARD_WIDTH;
    var cardHeight = CARD_HEIGHT;

    // Create pre-comp with default dimensions (will resize to fit content)
    var preComp = app.project.items.addComp(
        preCompName,
        cardWidth,
        cardHeight,
        1.0,
        mainComp.duration,
        mainComp.frameRate
    );

    // Move pre-comp to Comp folder
    if (folderInfo && folderInfo.compFolder) {
        preComp.parentFolder = folderInfo.compFolder;
    }

    // 2. Import Front Image
    var frontLayer = importAndAddLayer(preComp, cardInfo.filename, assetsPath, "Front");

    // 3. Import Back Image
    var backLayer = importAndAddLayer(preComp, cardInfo.backImage || "back.png", assetsPath, "Back");

    // Resize pre-comp to match asset size if needed
    if (frontLayer && frontLayer.source) {
        preComp.width = frontLayer.source.width;
        preComp.height = frontLayer.source.height;
        // Re-center layers
        if (frontLayer) frontLayer.property("Position").setValue([preComp.width / 2, preComp.height / 2]);
        if (backLayer) backLayer.property("Position").setValue([preComp.width / 2, preComp.height / 2]);
    }

    // 4. Set Initial Visibility based on Face State
    // We use Opacity instead of Enabled so we can keyframe it later inside the pre-comp
    // However, since we are inside a pre-comp, the time is relative.
    // We will control the visibility by keyframing Opacity inside this pre-comp
    // at time 0 based on isFaceUp.

    var isFaceUp = cardInfo.isFaceUp === true;

    if (frontLayer) frontLayer.property("Opacity").setValue(isFaceUp ? 100 : 0);
    if (backLayer) backLayer.property("Opacity").setValue(isFaceUp ? 0 : 100);

    // 5. Add Pre-Comp to Main Comp
    var preCompLayer = mainComp.layers.add(preComp);
    preCompLayer.name = cardId;

    // Enable 3D for z-ordering - cards will use Z position to control stacking
    preCompLayer.threeDLayer = true;

    // Note: collapseTransformation conflicts with 3D layer behavior
    // Leaving it OFF to enable proper 3D z-ordering
    // preCompLayer.collapseTransformation = true;

    // Set anchor point to center
    setAnchorPointToCenter(preCompLayer);

    return preCompLayer;
}

/**
 * Helper to import file and add to comp
 */
function importAndAddLayer(comp, filename, rootPath, layerName) {
    if (!filename) return null;

    var fullPath = resolveAssetPath(filename, rootPath);
    if (!fullPath) return null;

    var file = new File(fullPath);
    if (!file.exists) return null;

    var importOptions = new ImportOptions(file);
    var footage = app.project.importFile(importOptions);

    // Move footage to Card_IMG folder
    if (sessionFolders && sessionFolders.cardImgFolder) {
        footage.parentFolder = sessionFolders.cardImgFolder;
    }

    var layer = comp.layers.add(footage);
    layer.name = layerName;

    return layer;
}

/**
 * Set anchor point to center of layer
 */
function setAnchorPointToCenter(layer) {
    try {
        var sourceWidth = layer.width;
        var sourceHeight = layer.height;

        if (layer.source) {
            sourceWidth = layer.source.width;
            sourceHeight = layer.source.height;
        }

        var centerX = sourceWidth / 2;
        var centerY = sourceHeight / 2;

        layer.property("Anchor Point").setValue([centerX, centerY]);
    } catch (e) {
        // Ignore
    }
}

/**
 * Apply initial transform properties to layer (3D)
 * zOrder (from layout) or zonePosition determines initial Z:
 * - Higher zOrder = more NEGATIVE Z = closer to camera = in FRONT
 * isFaceUp determines initial Y Rotation: true = 180°, false = 0°
 */
function applyInitialTransform(layer, assetInfo, comp) {
    // Get z-order for Z calculation
    // Prioritize zOrder from layout (Pusoy) over zonePosition
    var zOrderValue = assetInfo.zOrder !== undefined ? assetInfo.zOrder :
        (assetInfo.zonePosition || 0);

    // Calculate Z: higher zOrder = more NEGATIVE Z (closer to camera = in front)
    var zPos = INITIAL_Z_OFFSET - (zOrderValue * Z_SPACING);

    // Position (3D: X, Y, Z)
    var posX = assetInfo.x !== undefined ? assetInfo.x : comp.width / 2;
    var posY = assetInfo.y !== undefined ? assetInfo.y : comp.height / 2;
    layer.property("Position").setValue([posX, posY, zPos]);

    // Z Rotation (table rotation)
    var rotation = assetInfo.rotation !== undefined ? assetInfo.rotation : 0;
    layer.property("Z Rotation").setValue(rotation);

    // Y Rotation for card face: Face-up = 0°, Face-down = 180°
    var yRotation = assetInfo.isFaceUp ? 0 : 180;
    layer.property("Y Rotation").setValue(yRotation);

    // Scale (3D: X, Y, Z)
    var scale = assetInfo.scale !== undefined ? assetInfo.scale * 100 : 100;
    layer.property("Scale").setValue([scale, scale, 100]);
}

/**
 * Create Control Layer with Expression Control sliders
 * This allows user to adjust card size, spacing after export
 */
function createControlLayer(comp) {
    // Create a null layer for controls
    var controlLayer = comp.layers.addNull();
    controlLayer.name = "🎛️ Controls";
    controlLayer.guideLayer = true;
    controlLayer.moveToBeginning();
    controlLayer.outPoint = comp.duration;

    // Add Expression Control effects
    // Card Scale (default 50%)
    var cardScaleEffect = controlLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    cardScaleEffect.name = "Card Scale";
    cardScaleEffect.property("Slider").setValue(50);

    // Top Zone Y Offset
    var topYEffect = controlLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    topYEffect.name = "Top Zone Y";
    topYEffect.property("Slider").setValue(0);

    // Bottom Zone Y Offset
    var bottomYEffect = controlLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    bottomYEffect.name = "Bottom Zone Y";
    bottomYEffect.property("Slider").setValue(0);

    // Left Zone X Offset
    var leftXEffect = controlLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    leftXEffect.name = "Left Zone X";
    leftXEffect.property("Slider").setValue(0);

    // Right Zone X Offset
    var rightXEffect = controlLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
    rightXEffect.name = "Right Zone X";
    rightXEffect.property("Slider").setValue(0);

    return controlLayer;
}

/**
 * Create Zone Null layers as parents for cards
 * Each zone null's position is linked to Control layer sliders
 * @returns {Object} Map of zone name to null layer
 */
function createZoneNulls(comp, controlLayerName) {
    var zoneNulls = {};
    var zones = ["top", "bottom", "left", "right", "community"];

    for (var i = 0; i < zones.length; i++) {
        var zoneName = zones[i];
        var center = ZONE_CENTERS[zoneName];
        if (!center) continue;

        // Create null layer for this zone
        var zoneNull = comp.layers.addNull();
        zoneNull.name = "Zone_" + zoneName;
        zoneNull.threeDLayer = true;
        zoneNull.outPoint = comp.duration;

        // Set initial position at zone center
        zoneNull.property("Position").setValue([center.x, center.y, 0]);

        // Apply expression to link position to Control sliders
        var expr = "";
        if (zoneName === "top") {
            expr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n' +
                'var offset = ctrl.effect("Top Zone Y")("Slider");\n' +
                '[' + center.x + ', ' + center.y + ' + offset, 0]';
        } else if (zoneName === "bottom") {
            expr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n' +
                'var offset = ctrl.effect("Bottom Zone Y")("Slider");\n' +
                '[' + center.x + ', ' + center.y + ' + offset, 0]';
        } else if (zoneName === "left") {
            expr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n' +
                'var offset = ctrl.effect("Left Zone X")("Slider");\n' +
                '[' + center.x + ' + offset, ' + center.y + ', 0]';
        } else if (zoneName === "right") {
            expr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n' +
                'var offset = ctrl.effect("Right Zone X")("Slider");\n' +
                '[' + center.x + ' + offset, ' + center.y + ', 0]';
        } else {
            // Community - no offset for now
            expr = '[' + center.x + ', ' + center.y + ', 0]';
        }

        zoneNull.property("Position").expression = expr;

        zoneNulls[zoneName] = zoneNull;
    }

    return zoneNulls;
}

/**
 * Apply Scale expression to card layer
 * Links to Control Layer's Card Scale slider
 */
function applyScaleExpression(layer, controlLayerName) {
    var expr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n' +
        'var scale = ctrl.effect("Card Scale")("Slider");\n' +
        '[scale, scale, 100]';
    layer.property("Scale").expression = expr;
}

/**
 * Apply Zone Offset expression to card layer Position
 * Adds offset based on card's zone without replacing keyframe values
 * @param {Layer} cardLayer - The card layer
 * @param {string} controlLayerName - Name of control layer
 * @param {string} zoneName - Zone the card belongs to (top, bottom, left, right)
 */
function applyZoneOffsetExpression(cardLayer, controlLayerName, zoneName) {
    var expr = "";
    // Expression that only adds offset to FIRST keyframe
    // After first animation, uses original values
    var baseExpr = 'var ctrl = thisComp.layer("' + controlLayerName + '");\n';

    if (zoneName === "top") {
        expr = baseExpr +
            'var offset = ctrl.effect("Top Zone Y")("Slider");\n' +
            'if (numKeys < 2) { [value[0], value[1] + offset, value[2]] }\n' +
            'else {\n' +
            '  var k1 = key(1); var k2 = key(2);\n' +
            '  if (time <= k1.time) { [k1.value[0], k1.value[1] + offset, k1.value[2]] }\n' +
            '  else if (time < k2.time) {\n' +
            '    var t = (time - k1.time) / (k2.time - k1.time);\n' +
            '    var startY = k1.value[1] + offset;\n' +
            '    var endY = k2.value[1];\n' +
            '    [linear(t, 0, 1, k1.value[0], k2.value[0]), linear(t, 0, 1, startY, endY), linear(t, 0, 1, k1.value[2], k2.value[2])]\n' +
            '  } else { value }\n' +
            '}';
    } else if (zoneName === "bottom") {
        expr = baseExpr +
            'var offset = ctrl.effect("Bottom Zone Y")("Slider");\n' +
            'if (numKeys < 2) { [value[0], value[1] + offset, value[2]] }\n' +
            'else {\n' +
            '  var k1 = key(1); var k2 = key(2);\n' +
            '  if (time <= k1.time) { [k1.value[0], k1.value[1] + offset, k1.value[2]] }\n' +
            '  else if (time < k2.time) {\n' +
            '    var t = (time - k1.time) / (k2.time - k1.time);\n' +
            '    var startY = k1.value[1] + offset;\n' +
            '    var endY = k2.value[1];\n' +
            '    [linear(t, 0, 1, k1.value[0], k2.value[0]), linear(t, 0, 1, startY, endY), linear(t, 0, 1, k1.value[2], k2.value[2])]\n' +
            '  } else { value }\n' +
            '}';
    } else if (zoneName === "left") {
        expr = baseExpr +
            'var offset = ctrl.effect("Left Zone X")("Slider");\n' +
            'if (numKeys < 2) { [value[0] + offset, value[1], value[2]] }\n' +
            'else {\n' +
            '  var k1 = key(1); var k2 = key(2);\n' +
            '  if (time <= k1.time) { [k1.value[0] + offset, k1.value[1], k1.value[2]] }\n' +
            '  else if (time < k2.time) {\n' +
            '    var t = (time - k1.time) / (k2.time - k1.time);\n' +
            '    var startX = k1.value[0] + offset;\n' +
            '    var endX = k2.value[0];\n' +
            '    [linear(t, 0, 1, startX, endX), linear(t, 0, 1, k1.value[1], k2.value[1]), linear(t, 0, 1, k1.value[2], k2.value[2])]\n' +
            '  } else { value }\n' +
            '}';
    } else if (zoneName === "right") {
        expr = baseExpr +
            'var offset = ctrl.effect("Right Zone X")("Slider");\n' +
            'if (numKeys < 2) { [value[0] + offset, value[1], value[2]] }\n' +
            'else {\n' +
            '  var k1 = key(1); var k2 = key(2);\n' +
            '  if (time <= k1.time) { [k1.value[0] + offset, k1.value[1], k1.value[2]] }\n' +
            '  else if (time < k2.time) {\n' +
            '    var t = (time - k1.time) / (k2.time - k1.time);\n' +
            '    var startX = k1.value[0] + offset;\n' +
            '    var endX = k2.value[0];\n' +
            '    [linear(t, 0, 1, startX, endX), linear(t, 0, 1, k1.value[1], k2.value[1]), linear(t, 0, 1, k1.value[2], k2.value[2])]\n' +
            '  } else { value }\n' +
            '}';
    } else {
        return;
    }

    cardLayer.property("Position").expression = expr;
}


/**
 * Process all scenario steps and apply animations
 * Uses Z-position keyframes to control card stacking order over time
 * @param stepBlending - Overlap percentage (0-50) to reduce time between steps
 */
function processScenarioAnimation(comp, scenario, layerMap, stepBlending) {
    var currentTime = 0;
    var moveCounter = 0;  // Tracks order of card movements for z-ordering

    // Calculate base Z for moving cards - they should always be in front of initial cards
    // Initial cards have Z from 0 to -(maxZonePosition * Z_SPACING)
    // Moving cards will start at a more negative Z
    var baseZForMovingCards = -100;  // Well in front of any initial card positions

    // Calculate blending factor (0 = no overlap, 0.5 = 50% overlap)
    var blendFactor = (stepBlending || 0) / 100;

    // Track selection state per card for Y offset animation
    var cardSelectionState = {};

    for (var s = 0; s < scenario.length; s++) {
        var step = scenario[s];
        var stepDuration = step.duration || 1.0;
        var actions = step.actions || [];

        // Process each action in this step
        for (var a = 0; a < actions.length; a++) {
            var action = actions[a];
            var targetId = action.targetId;
            var layer = layerMap[targetId];

            if (!layer) continue;

            try {
                // Process SELECT/DESELECT actions (grouping mode Y offset)
                if (action.type === "SELECT" || action.type === "DESELECT") {
                    processSelectionAction(layer, action, currentTime, stepDuration, cardSelectionState);
                    continue; // SELECT/DESELECT doesn't need TRANSFORM processing
                }

                // Calculate target Z for this card based on destination zone's zOrder
                // If action has endZOrder (from grid layout like Pusoy), use it for proper row stacking
                // Otherwise fall back to moveCounter for non-grid layouts
                var targetZ;
                if (action.endZOrder !== undefined && action.endZOrder > 0) {
                    // Use destination zone's zOrder: higher zOrder = more NEGATIVE Z = in front
                    // Same formula as applyInitialTransform
                    targetZ = INITIAL_Z_OFFSET - (action.endZOrder * Z_SPACING);
                } else {
                    // Fallback: cards that move LATER get MORE NEGATIVE Z (on top)
                    targetZ = baseZForMovingCards - (moveCounter * Z_SPACING);
                }
                moveCounter++;

                // Process transform animation (X, Y, Z position)
                // Pass selectionState so TRANSFORM knows if card is currently lifted
                processTransformAction(layer, action, currentTime, stepDuration, targetZ, cardSelectionState);

                // After transform, card is no longer lifted (it has moved to new position)
                if (cardSelectionState[targetId]) {
                    cardSelectionState[targetId] = false;
                }

                // Process FLIP effect
                if (action.flip === true) {
                    processFlipEffect(layer, currentTime, stepDuration, action.flipToFaceUp);
                }

                // Process SLAM effect
                if (action.effect === "SLAM") {
                    processSlamEffect(layer, currentTime, stepDuration, comp);
                }

            } catch (e) {
                $.writeln("Error processing action for " + targetId + ": " + e.toString());
            }
        }

        // Advance current time (with blending overlap)
        var blendedDuration = stepDuration * (1 - blendFactor);
        currentTime += blendedDuration;
    }

    return { success: true, finalTime: currentTime };
}

/**
 * Process SELECT/DESELECT action - animates Y offset for lift up/down effect
 * SELECT: moves card up by 25px (scaled to AE coordinates)
 * DESELECT: moves card back down to original position
 * Uses position from action data (calculated in computeActions via getAEPosition)
 */
function processSelectionAction(layer, action, startTime, stepDuration, selectionState) {
    var frameDuration = 1 / FRAME_RATE;
    var selectDuration = 5 * frameDuration; // 5 frames for selection animation

    var positionProp = layer.property("Position");

    // Use position from action data (correct position for the zone)
    var baseX = action.position.x;
    var baseY = action.position.y;

    // Get current Z from layer (Z is managed separately for stacking)
    var currentPos = positionProp.valueAtTime(startTime, false);
    var baseZ = currentPos.length > 2 ? currentPos[2] : 0;

    // Selection offset (25px in UI = scaled for AE 1920x1080 vs UI 1280x720)
    // Scale factor is 1.5 (1920/1280), so 25px becomes ~37.5px
    var SELECT_OFFSET_Y = 37.5;

    var startY, endY;

    if (action.type === "SELECT") {
        // SELECT: card is at base position, moves UP
        startY = baseY;
        endY = baseY - SELECT_OFFSET_Y;
        selectionState[action.targetId] = true;
    } else {
        // DESELECT: card was lifted (at baseY - offset), moves back DOWN to baseY
        startY = baseY - SELECT_OFFSET_Y;
        endY = baseY;
        selectionState[action.targetId] = false;
    }

    var endTime = startTime + selectDuration;

    // Set keyframes
    positionProp.setValueAtTime(startTime, [baseX, startY, baseZ]);
    positionProp.setValueAtTime(endTime, [baseX, endY, baseZ]);

    // Apply smooth easing
    applyBezierEasing(positionProp);
}



/**
 * Process transform (position, rotation) animation (3D)
 * Includes Z-position animation for stacking order
 * @param selectionState - tracks which cards are currently "lifted" from SELECT action
 */
function processTransformAction(layer, action, startTime, duration, targetZ, selectionState) {
    var frameDuration = 1 / FRAME_RATE;
    var moveDuration = MOVE_DURATION_FRAMES * frameDuration;  // ~0.33s for movement
    var rotDuration = FLIP_DURATION_FRAMES * frameDuration;   // ~0.17s for rotation

    var positionProp = layer.property("Position");
    var rotationProp = layer.property("Z Rotation");  // Use Z Rotation for 3D layers

    // Get current values (fallback) - 3D position has [X, Y, Z]
    var currentPos = positionProp.valueAtTime(startTime, false);
    var currentRot = rotationProp.valueAtTime(startTime, false);

    // Get current Z position
    var startZ = currentPos[2] !== undefined ? currentPos[2] : 0;

    // Determine start values - prefer action data over current state
    var startX = currentPos[0];
    var startY = currentPos[1];
    var startRot = currentRot;

    if (action.startPosition && action.startPosition.x !== undefined) {
        startX = action.startPosition.x;
        startY = action.startPosition.y;
    }

    // If card is currently lifted (from SELECT action), apply the lifted offset to startY
    // This prevents the "snap back to original position" before moving
    var SELECT_OFFSET_Y = 37.5; // 25px UI * 1.5 scale
    var isCurrentlyLifted = selectionState && selectionState[action.targetId];
    if (isCurrentlyLifted) {
        startY = startY - SELECT_OFFSET_Y;
    }
    if (action.startRotation !== undefined) {
        startRot = action.startRotation;
    }

    // Determine end values
    var endX = startX;
    var endY = startY;
    var endRot = startRot;

    if (action.endPosition && action.endPosition.x !== undefined) {
        endX = action.endPosition.x;
        endY = action.endPosition.y;
    }
    if (action.endRotation !== undefined) {
        endRot = action.endRotation;
    }

    // Position animation: 10 frames (~0.33s)
    // Z-order animation uses 3 keyframes:
    //   1. startTime: current Z (where card is)
    //   2. startTime + 1 frame: jump to VERY front Z (above all other cards during move)
    //   3. endTime: settle to targetZ
    var posEndTime = startTime + moveDuration;
    var frontZ = -200; // Very front, above all other cards during movement

    // Keyframe 1: Start position with current Z
    positionProp.setValueAtTime(startTime, [startX, startY, startZ]);

    // Keyframe 2: One frame later, jump to front Z while starting to move
    // This ensures the card is above all others during the swap animation
    var liftTime = startTime + frameDuration;
    // Interpolate XY position at liftTime (1 frame into animation)
    var liftProgress = frameDuration / moveDuration; // ~0.1 for 1 of 10 frames
    var liftX = startX + (endX - startX) * liftProgress;
    var liftY = startY + (endY - startY) * liftProgress;
    positionProp.setValueAtTime(liftTime, [liftX, liftY, frontZ]);

    // Keyframe 3: End position with targetZ
    positionProp.setValueAtTime(posEndTime, [endX, endY, targetZ]);

    // Rotation animation: 5 frames (~0.17s) - quick and decisive
    var rotEndTime = startTime + rotDuration;
    rotationProp.setValueAtTime(startTime, startRot);
    rotationProp.setValueAtTime(rotEndTime, endRot);

    // Apply Bezier interpolation
    applyBezierEasing(positionProp);
    applyBezierEasing(rotationProp);
}


/**
 * Process FLIP effect using Y Rotation (3D)
 * Face down (back) = 0° Y Rotation
 * Face up (front) = 180° Y Rotation
 * Switch visibility at 90° (perpendicular to view)
 * 
 * TIMING: Flip starts 1 frame before move ends, so card flips as it lands
 */
function processFlipEffect(layer, startTime, duration, flipToFaceUp) {
    var yRotProp = layer.property("Y Rotation");

    var frameDuration = 1 / FRAME_RATE;
    var flipDuration = FLIP_DURATION_FRAMES * frameDuration;
    var moveDuration = MOVE_DURATION_FRAMES * frameDuration;

    // Calculate flip start time: start flip 1 frame before move ends
    var flipStartTime = startTime + moveDuration - frameDuration;
    var midTime = flipStartTime + flipDuration * 0.5;
    var endTime = flipStartTime + flipDuration;

    // 1. ANIMATE Y ROTATION (Flip effect)
    // Face-down = 180°, Face-up = 0°
    if (flipToFaceUp) {
        // Flip to face up: 180° -> 0°
        yRotProp.setValueAtTime(flipStartTime, 180);
        yRotProp.setValueAtTime(endTime, 0);
    } else {
        // Flip to face down: 0° -> 180°
        yRotProp.setValueAtTime(flipStartTime, 0);
        yRotProp.setValueAtTime(endTime, 180);
    }

    applyBezierEasing(yRotProp);

    // 2. TOGGLE VISIBILITY INSIDE PRE-COMP at mid-flip (90°)
    var preComp = layer.source;
    if (preComp && preComp instanceof CompItem) {
        var frontLayer = preComp.layer("Front");
        var backLayer = preComp.layer("Back");

        if (frontLayer && backLayer) {
            var frontOp = frontLayer.property("Opacity");
            var backOp = backLayer.property("Opacity");

            var t = midTime;

            if (flipToFaceUp) {
                // Switch to Front Visible at 90°
                frontOp.setValueAtTime(t - 0.01, 0);
                frontOp.setValueAtTime(t, 100);

                backOp.setValueAtTime(t - 0.01, 100);
                backOp.setValueAtTime(t, 0);
            } else {
                // Switch to Back Visible at 90°
                frontOp.setValueAtTime(t - 0.01, 100);
                frontOp.setValueAtTime(t, 0);

                backOp.setValueAtTime(t - 0.01, 0);
                backOp.setValueAtTime(t, 100);
            }

            setHoldInterpolation(frontOp);
            setHoldInterpolation(backOp);
        }
    }
}

/**
 * Set all keyframes of a property to Hold interpolation
 */
function setHoldInterpolation(property) {
    if (property.numKeys > 0) {
        for (var i = 1; i <= property.numKeys; i++) {
            property.setInterpolationTypeAtKey(i, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }
    }
}

/**
 * Process SLAM effect (bounce when card lands)
 * Starts when position animation ENDS (card lands) with diminishing oscillation
 * Pattern: base → +8% → -2% → base (over 6 frames)
 */
function processSlamEffect(layer, startTime, stepDuration, comp) {
    var scaleProp = layer.property("Scale");
    var frameDuration = 1 / comp.frameRate;

    // Slam starts when position animation ENDS (card lands)
    var moveDuration = MOVE_DURATION_FRAMES * frameDuration;
    var slamStartTime = startTime + moveDuration;

    // Get base scale at land time
    var currentScale = scaleProp.valueAtTime(slamStartTime, false);
    var baseX = currentScale[0];
    var baseY = currentScale[1];
    var baseZ = currentScale.length > 2 ? currentScale[2] : baseX;

    // Bounce pattern: base → +8% → -2% → base
    // Keyframe 0 (land): base
    // Keyframe 2 frames: +8% overshoot
    // Keyframe 4 frames: -2% undershoot
    // Keyframe 6 frames: back to base
    var overshootX = baseX * 1.08;
    var overshootY = baseY * 1.08;
    var undershootX = baseX * 0.98;
    var undershootY = baseY * 0.98;

    var t0 = slamStartTime;
    var t1 = slamStartTime + (2 * frameDuration);
    var t2 = slamStartTime + (4 * frameDuration);
    var t3 = slamStartTime + (6 * frameDuration);

    // Set keyframes (3D scale for 3D layers)
    scaleProp.setValueAtTime(t0, [baseX, baseY, baseZ]);
    scaleProp.setValueAtTime(t1, [overshootX, overshootY, baseZ]);
    scaleProp.setValueAtTime(t2, [undershootX, undershootY, baseZ]);
    scaleProp.setValueAtTime(t3, [baseX, baseY, baseZ]);

    // Apply ease for smooth bounce
    applyBezierEasing(scaleProp);
    layer.motionBlur = true;
}

// ============================================
// EASING FUNCTIONS
// ============================================

function applyBezierEasing(property) {
    var numKeys = property.numKeys;
    if (numKeys < 2) return;

    for (var k = 1; k <= numKeys; k++) {
        try {
            // Skip Hold keyframes
            if (property.keyOutInterpolationType(k) === KeyframeInterpolationType.HOLD) continue;

            property.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

            // Strong ease-in/ease-out for smooth motion
            // speed=0 means velocity is zero at keyframe (smooth stop/start)
            // influence=75 gives strong easing effect
            var easeIn = new KeyframeEase(0, 75);
            var easeOut = new KeyframeEase(0, 75);

            var dims = (property.value instanceof Array) ? property.value.length : 1;

            if (dims === 1) {
                property.setTemporalEaseAtKey(k, [easeIn], [easeOut]);
            } else if (dims === 2) {
                property.setTemporalEaseAtKey(k, [easeIn, easeIn], [easeOut, easeOut]);
            } else {
                property.setTemporalEaseAtKey(k, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
            }
        } catch (e) { }
    }
}

function applyBounceEasing(property, slamStartTime) {
    // Similar to previous implementation...
    // Only ease keys near slamStartTime
    var numKeys = property.numKeys;
    if (numKeys < 2) return;

    for (var k = 1; k <= numKeys; k++) {
        if (Math.abs(property.keyTime(k) - slamStartTime) < 0.2) {
            try {
                property.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                var ease = new KeyframeEase(0, 75); // Strong ease
                var dims = (property.value instanceof Array) ? property.value.length : 1;

                if (dims === 2) property.setTemporalEaseAtKey(k, [ease, ease], [ease, ease]);
                else property.setTemporalEaseAtKey(k, [ease], [ease]);
            } catch (e) { }
        }
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateTotalDuration(scenario) {
    var total = 0;
    for (var i = 0; i < scenario.length; i++) {
        total += scenario[i].duration || 1.0;
    }
    return total;
}

// ============================================
// FOLDER ORGANIZATION FUNCTIONS
// ============================================

/**
 * Get or create a folder in the project
 * @param {string} folderName - Name of the folder
 * @param {FolderItem} parentFolder - Optional parent folder (null for root)
 * @returns {FolderItem} The folder item
 */
function getOrCreateFolder(folderName, parentFolder) {
    // Search for existing folder
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof FolderItem && item.name === folderName) {
            // Check parent match
            if (parentFolder === null && item.parentFolder === app.project.rootFolder) {
                return item;
            } else if (parentFolder && item.parentFolder === parentFolder) {
                return item;
            }
        }
    }

    // Create new folder
    var newFolder = app.project.items.addFolder(folderName);
    if (parentFolder) {
        newFolder.parentFolder = parentFolder;
    }
    return newFolder;
}

/**
 * Generate unique session ID based on board type
 * @param {string} boardType - Type of board (poker, grid, etc.)
 * @returns {string} Session ID like "poker_01", "poker_02", etc.
 */
function generateSessionId(boardType) {
    var baseName = boardType || "poker";
    var counter = 1;

    // Find existing folders with this prefix to determine next number
    var cardImgFolder = getOrCreateFolder(FOLDER_CARD_IMG, null);

    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof FolderItem && item.parentFolder === cardImgFolder) {
            // Check if name matches pattern: baseName_XX
            var name = item.name;
            if (name.indexOf(baseName + "_") === 0) {
                var numPart = name.substring((baseName + "_").length);
                var num = parseInt(numPart, 10);
                if (!isNaN(num) && num >= counter) {
                    counter = num + 1;
                }
            }
        }
    }

    // Format with leading zero
    var numStr = counter < 10 ? "0" + counter : "" + counter;
    return baseName + "_" + numStr;
}

/**
 * Setup project folders for a new session
 * @param {string} boardType - Type of board layout
 * @returns {object} Object containing folder references and session info
 */
function setupProjectFolders(boardType) {
    var sessionId = generateSessionId(boardType);

    // Create main folders if not exist
    var cardImgFolder = getOrCreateFolder(FOLDER_CARD_IMG, null);
    var compFolder = getOrCreateFolder(FOLDER_COMP, null);

    // Create session subfolders
    var sessionCardImgFolder = getOrCreateFolder(sessionId, cardImgFolder);
    var sessionCompFolder = getOrCreateFolder(sessionId, compFolder);

    return {
        sessionId: sessionId,
        cardImgFolder: sessionCardImgFolder,
        compFolder: sessionCompFolder
    };
}

function normalizeAssetPath(path) {
    if (!path) return "";
    if (path.indexOf("file://") === 0) path = path.substring(7);

    var result = "";
    for (var i = 0; i < path.length; i++) {
        result += (path.charAt(i) === "\\") ? "/" : path.charAt(i);
    }
    if (result.length > 0 && result.charAt(result.length - 1) !== "/") result += "/";
    return result;
}

function resolveAssetPath(assetPath, rootPath) {
    if (!assetPath) return null;
    if (assetPath.indexOf("file://") === 0) assetPath = assetPath.substring(7);
    if (assetPath.indexOf("blob:") === 0) return null;

    // Check for absolute path (Windows drive or Forward slash)
    var isAbsolute = (assetPath.length >= 2 && assetPath.charAt(1) === ":") || assetPath.charAt(0) === "/";
    return isAbsolute ? assetPath : (rootPath ? rootPath + assetPath : assetPath);
}

/**
 * Get dimension count of a property value
 * @param {Property} property - The property
 * @returns {number} Number of dimensions (1, 2, or 3)
 */
function getDimensionCount(property) {
    try {
        var value = property.value;
        if (value instanceof Array) {
            return value.length;
        }
        return 1;
    } catch (e) {
        return 1;
    }
}

/**
 * Create placeholder shape layer for missing asset
 * @param {CompItem} comp - Parent composition
 * @param {string} name - Layer name
 * @returns {ShapeLayer} Created shape layer
 */
function createPlaceholderLayer(comp, name) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = name + " (placeholder)";

    var cardWidth = 80;
    var cardHeight = 112;

    // Add rectangle shape group
    var contents = shapeLayer.property("ADBE Root Vectors Group");
    var shapeGroup = contents.addProperty("ADBE Vector Group");
    shapeGroup.name = "Card Shape";

    // Rectangle path
    var shapesGroup = shapeGroup.property("ADBE Vectors Group");
    var rect = shapesGroup.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);
    rect.property("ADBE Vector Rect Roundness").setValue(8);

    // Fill
    var fill = shapesGroup.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue([0.9, 0.9, 0.9, 1]);

    // Stroke
    var stroke = shapesGroup.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue([0.3, 0.3, 0.3, 1]);
    stroke.property("ADBE Vector Stroke Width").setValue(2);

    return shapeLayer;
}

/**
 * Create success response JSON
 * @param {string} message - Success message
 * @param {string} compName - Created composition name
 * @returns {string} JSON response string
 */
function createSuccessResponse(message, compName) {
    return JSON.stringify({
        success: true,
        message: message,
        compName: compName
    });
}

/**
 * Create error response JSON
 * @param {string} message - Error message
 * @returns {string} JSON response string
 */
function createErrorResponse(message) {
    return JSON.stringify({
        success: false,
        message: message
    });
}

// ============================================
// CEP PANEL INTERFACE FUNCTIONS
// ============================================

/**
 * Import poker scenario from CEP panel
 * Wrapper for generateSequence with default assets path
 * @param {string} jsonString - JSON scenario data
 * @returns {string} JSON result
 */
function importPokerScenario(jsonString) {
    // Use empty assets path (paths in JSON should be absolute)
    return generateSequence(jsonString, "");
}

/**
 * Import poker scenario with custom assets folder
 * @param {string} jsonString - JSON scenario data
 * @param {string} assetsFolder - Path to assets folder
 * @returns {string} JSON result
 */
function importPokerScenarioWithAssets(jsonString, assetsFolder) {
    return generateSequence(jsonString, assetsFolder);
}

/**
 * Test function to verify script is loaded
 * @returns {string} Test response
 */
function testConnection() {
    return JSON.stringify({
        success: true,
        message: "Autonim-Poker ExtendScript is loaded and ready",
        version: "2.0.0"
    });
}

// ============================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================

/**
 * Legacy: Import poker animation (realtime keyframes)
 * Kept for backward compatibility
 */
function importPokerAnimation(jsonString) {
    try {
        var data = JSON.parse(jsonString);
        var compName = data.compName || "Poker_Animation";
        var frameRate = data.frameRate || 30;
        var layers = data.layers || [];

        if (layers.length === 0) {
            return createErrorResponse("No layers to import");
        }

        app.beginUndoGroup("Autonim-Poker: Import Animation (Legacy)");

        // Calculate duration
        var maxDuration = 2.0;
        for (var i = 0; i < layers.length; i++) {
            var kfs = layers[i].keyframes;
            if (kfs && kfs.length > 0) {
                var lastTime = kfs[kfs.length - 1].time;
                if (lastTime > maxDuration) maxDuration = lastTime + 0.5;
            }
        }

        var comp = app.project.items.addComp(compName, COMP_WIDTH, COMP_HEIGHT, 1.0, maxDuration, frameRate);

        for (var j = 0; j < layers.length; j++) {
            var layerData = layers[j];
            importLegacyCardLayer(comp, layerData);
        }

        app.endUndoGroup();
        comp.openInViewer();

        return createSuccessResponse("Imported " + layers.length + " layers", compName);

    } catch (error) {
        app.endUndoGroup();
        return createErrorResponse("Legacy import error: " + error.toString());
    }
}

function importLegacyCardLayer(comp, layerData) {
    var layer = createPlaceholderLayer(comp, layerData.name || "Card");
    var keyframes = layerData.keyframes || [];

    if (keyframes.length > 0) {
        var positionProp = layer.property("Position");
        var rotationProp = layer.property("Rotation");

        for (var i = 0; i < keyframes.length; i++) {
            var kf = keyframes[i];
            positionProp.setValueAtTime(kf.time, [kf.x, kf.y]);
            rotationProp.setValueAtTime(kf.time, kf.rotation);
        }
    }
}
