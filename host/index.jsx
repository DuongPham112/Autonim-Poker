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

        // Calculate total duration from scenario
        var totalDuration = calculateTotalDuration(data.scenario);
        totalDuration = Math.max(totalDuration + 0.5, 2.0); // Add buffer, minimum 2 seconds

        // Create new composition
        var timestamp = new Date().getTime();
        var compName = "Poker_Render_" + timestamp;
        var comp = app.project.items.addComp(
            compName,
            data.projectInfo.width || COMP_WIDTH,
            data.projectInfo.height || COMP_HEIGHT,
            1.0,  // Pixel aspect ratio
            totalDuration,
            data.projectInfo.fps || FRAME_RATE
        );

        // Store layer references by ID
        var layerMap = {};

        // Setup initial scene state (Create Pre-Comps)
        var setupResult = setupInitialScene(comp, data.initialState, assetsRootPath, layerMap);
        if (!setupResult.success) {
            app.endUndoGroup();
            return createErrorResponse(setupResult.message);
        }

        // Process scenario animation steps
        var animResult = processScenarioAnimation(comp, data.scenario, layerMap);
        if (!animResult.success) {
            app.endUndoGroup();
            return createErrorResponse(animResult.message);
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
 * @returns {object} Result with success status
 */
function setupInitialScene(comp, initialState, assetsRootPath, layerMap) {
    var layerIndex = 1;
    var importErrors = [];

    for (var assetId in initialState) {
        if (!initialState.hasOwnProperty(assetId)) continue;

        var assetInfo = initialState[assetId];
        var layer = null;

        try {
            // Create Pre-Comp for this card (contains Front and Back layers)
            layer = createCardPrecomp(comp, assetId, assetInfo, assetsRootPath);

            if (!layer) {
                importErrors.push(assetId + " (failed to create pre-comp)");
                continue;
            }

            // Apply initial transform properties to the Pre-Comp Layer in Main Comp
            applyInitialTransform(layer, assetInfo, comp);

            // Store reference in layer map
            layerMap[assetId] = layer;
            layerIndex++;

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
 * @returns {Layer} The layer instance of the pre-comp in the main comp
 */
function createCardPrecomp(mainComp, cardId, cardInfo, assetsPath) {
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

    // Collapse Transformations (Continuous Rasterization) - vital for crisp edges if scaled
    preCompLayer.collapseTransformation = true;

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
 * Apply initial transform properties to layer
 */
function applyInitialTransform(layer, assetInfo, comp) {
    // Position
    var posX = assetInfo.x !== undefined ? assetInfo.x : comp.width / 2;
    var posY = assetInfo.y !== undefined ? assetInfo.y : comp.height / 2;
    layer.property("Position").setValue([posX, posY]);

    // Rotation
    var rotation = assetInfo.rotation !== undefined ? assetInfo.rotation : 0;
    layer.property("Rotation").setValue(rotation);

    // Scale
    var scale = assetInfo.scale !== undefined ? assetInfo.scale * 100 : 100;
    layer.property("Scale").setValue([scale, scale]);
}

// ============================================
// ANIMATION PROCESSING (Scenario Loop)
// ============================================

/**
 * Process all scenario steps and apply animations
 */
function processScenarioAnimation(comp, scenario, layerMap) {
    var currentTime = 0;

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
                // Process transform animation
                processTransformAction(layer, action, currentTime, stepDuration);

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

        // Advance current time
        currentTime += stepDuration;
    }

    return { success: true, finalTime: currentTime };
}

/**
 * Process transform (position, rotation) animation
 */
function processTransformAction(layer, action, startTime, duration) {
    var endTime = startTime + duration;
    var positionProp = layer.property("Position");
    var rotationProp = layer.property("Rotation");

    // Get current values (fallback)
    var currentPos = positionProp.valueAtTime(startTime, false);
    var currentRot = rotationProp.valueAtTime(startTime, false);

    // Determine start values - prefer action data over current state
    var startPos = currentPos;
    var startRot = currentRot;

    if (action.startPosition && action.startPosition.x !== undefined) {
        startPos = [action.startPosition.x, action.startPosition.y];
    }
    if (action.startRotation !== undefined) {
        startRot = action.startRotation;
    }

    // Determine end values
    var endPos = startPos;
    var endRot = startRot;

    if (action.endPosition && action.endPosition.x !== undefined) {
        endPos = [action.endPosition.x, action.endPosition.y];
    }
    if (action.endRotation !== undefined) {
        endRot = action.endRotation;
    }

    // Add Keyframes
    positionProp.setValueAtTime(startTime, startPos);
    positionProp.setValueAtTime(endTime, endPos);

    rotationProp.setValueAtTime(startTime, startRot);
    rotationProp.setValueAtTime(endTime, endRot);

    // Apply Bezier interpolation
    applyBezierEasing(positionProp);
    applyBezierEasing(rotationProp);
}


/**
 * Process FLIP effect using Pre-Comp Opacity Toggle
 * Animation:
 * 1. Main Layer: Scale X 100 -> 0 (at mid) -> 100 (at end)
 * 2. Pre-Comp Internals: Swap Opacity of Front/Back at mid time
 */
function processFlipEffect(layer, startTime, duration, flipToFaceUp) {
    var scaleProp = layer.property("Scale");
    var midTime = startTime + duration * 0.5;
    var endTime = startTime + duration;

    // 1. ANMIATE MAIN LAYER SCALE (Flip effect)
    var currentScale = scaleProp.valueAtTime(startTime, false);
    var scaleX = Math.abs(currentScale[0]); // Always positive start
    var scaleY = currentScale[1];

    // Keyframes: Start (100) -> Mid (0) -> End (100)
    scaleProp.setValueAtTime(startTime, [scaleX, scaleY]);
    scaleProp.setValueAtTime(midTime, [0, scaleY]);
    scaleProp.setValueAtTime(endTime, [scaleX, scaleY]);

    applyBezierEasing(scaleProp);

    // 2. TOGGLE VISIBILITY INSIDE PRE-COMP
    // We need to access the pre-comp item and add Hold keyframes to Opacity
    var preComp = layer.source;
    if (preComp && preComp instanceof CompItem) {
        var frontLayer = preComp.layer("Front");
        var backLayer = preComp.layer("Back");

        if (frontLayer && backLayer) {
            // Determine target opacity based on direction
            // flipToFaceUp = true  => Front 0->100, Back 100->0
            // flipToFaceUp = false => Front 100->0, Back 0->100

            var frontOp = frontLayer.property("Opacity");
            var backOp = backLayer.property("Opacity");

            // Set Hold Keyframes at midTime
            // Note: Since we are in a pre-comp, we use the same timeline times 
            // because the pre-comp layer starts at 0 in the main comp (usually).
            // If the layer was shifted in time, we'd need to adjust, but our generator 
            // creates layer starting at 0.

            var t = midTime;

            if (flipToFaceUp) {
                // Switch to Front Visible
                frontOp.setValueAtTime(t - 0.01, 0); // Before mid: Hidden
                frontOp.setValueAtTime(t, 100);      // At mid: Visible

                backOp.setValueAtTime(t - 0.01, 100); // Before mid: Visible
                backOp.setValueAtTime(t, 0);          // At mid: Hidden
            } else {
                // Switch to Back Visible
                frontOp.setValueAtTime(t - 0.01, 100);
                frontOp.setValueAtTime(t, 0);

                backOp.setValueAtTime(t - 0.01, 0);
                backOp.setValueAtTime(t, 100);
            }

            // Set all new keyframes to Hold Interpolation to prevent fading
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
 * Process SLAM effect (overshoot scale bounce)
 */
function processSlamEffect(layer, startTime, duration, comp) {
    var scaleProp = layer.property("Scale");
    var frameDuration = 1 / comp.frameRate;

    var slamStartTime = startTime + duration;
    var slamMidTime = slamStartTime + (SLAM_DURATION_FRAMES * 0.5 * frameDuration);
    var slamEndTime = slamStartTime + (SLAM_DURATION_FRAMES * frameDuration);

    var currentScale = scaleProp.valueAtTime(slamStartTime, false);
    var baseScaleX = currentScale[0];
    var baseScaleY = currentScale[1];

    var overshootFactor = SLAM_OVERSHOOT_SCALE / 100;

    scaleProp.setValueAtTime(slamStartTime, [baseScaleX, baseScaleY]);
    scaleProp.setValueAtTime(slamMidTime, [baseScaleX * overshootFactor, baseScaleY * overshootFactor]);
    scaleProp.setValueAtTime(slamEndTime, [baseScaleX, baseScaleY]);

    applyBounceEasing(scaleProp, slamStartTime);
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

            // Mild ease
            var easeIn = new KeyframeEase(0, 33);
            var easeOut = new KeyframeEase(0, 33);

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
