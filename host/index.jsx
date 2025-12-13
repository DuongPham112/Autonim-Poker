/**
 * ============================================
 * AUTONIM-POKER - ExtendScript for After Effects
 * Director Tool Animation Generator
 * ============================================
 * 
 * This script processes JSON scenario data from the Director Tool
 * and generates animated compositions in After Effects.
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

        // Setup initial scene state
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
            // Determine asset file path
            var assetPath = resolveAssetPath(assetInfo.path, assetsRootPath);

            if (assetPath) {
                var assetFile = new File(assetPath);

                if (assetFile.exists) {
                    // Import file as footage
                    var importOptions = new ImportOptions(assetFile);
                    var footage = app.project.importFile(importOptions);

                    // Add to composition
                    layer = comp.layers.add(footage);
                } else {
                    // File not found, create placeholder
                    importErrors.push(assetId + " (file not found)");
                    layer = createPlaceholderLayer(comp, assetInfo.name || assetId);
                }
            } else {
                // No valid path, create placeholder
                layer = createPlaceholderLayer(comp, assetInfo.name || assetId);
            }

            // Set layer name to match asset ID
            layer.name = assetId;

            // Set anchor point to center (IMPORTANT for proper rotation/scale)
            setAnchorPointToCenter(layer);

            // Apply initial transform properties
            applyInitialTransform(layer, assetInfo, comp);

            // Store reference in layer map
            layerMap[assetId] = layer;
            layerIndex++;

        } catch (e) {
            importErrors.push(assetId + " (" + e.toString() + ")");
            // Continue with other assets
        }
    }

    if (importErrors.length > 0) {
        // Log errors but don't fail
        $.writeln("Import warnings: " + importErrors.join(", "));
    }

    return { success: true, message: "Setup complete" };
}

/**
 * Set anchor point to center of layer
 * @param {Layer} layer - The layer to modify
 */
function setAnchorPointToCenter(layer) {
    try {
        var sourceWidth = 0;
        var sourceHeight = 0;

        if (layer.source && layer.source.width) {
            // Footage layer
            sourceWidth = layer.source.width;
            sourceHeight = layer.source.height;
        } else if (layer instanceof ShapeLayer) {
            // Shape layer - anchor already centered
            return;
        } else {
            // Fallback
            sourceWidth = layer.width || 100;
            sourceHeight = layer.height || 100;
        }

        var centerX = sourceWidth / 2;
        var centerY = sourceHeight / 2;

        layer.property("Anchor Point").setValue([centerX, centerY]);
    } catch (e) {
        $.writeln("Warning: Could not set anchor point for " + layer.name);
    }
}

/**
 * Apply initial transform properties to layer
 * @param {Layer} layer - The layer to transform
 * @param {object} assetInfo - Asset info from initialState
 * @param {CompItem} comp - Parent composition
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

    // Opacity
    if (assetInfo.opacity !== undefined) {
        layer.property("Opacity").setValue(assetInfo.opacity * 100);
    }
}

// ============================================
// ANIMATION PROCESSING (Scenario Loop)
// ============================================

/**
 * Process all scenario steps and apply animations
 * @param {CompItem} comp - The composition
 * @param {array} scenario - Array of step objects
 * @param {object} layerMap - Map of layer IDs to layer objects
 * @returns {object} Result with success status and final time
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

            if (!layer) {
                $.writeln("Warning: Layer not found for targetId: " + targetId);
                continue;
            }

            try {
                // Process transform animation
                processTransformAction(layer, action, currentTime, stepDuration, comp);

                // Process FLIP effect
                if (action.flip === true) {
                    processFlipEffect(layer, currentTime, stepDuration);
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
 * @param {Layer} layer - Target layer
 * @param {object} action - Action data
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @param {CompItem} comp - Parent composition
 */
function processTransformAction(layer, action, startTime, duration, comp) {
    var endTime = startTime + duration;

    // Get property references
    var positionProp = layer.property("Position");
    var rotationProp = layer.property("Rotation");

    // Get start values (current state at startTime)
    var startPos = positionProp.valueAtTime(startTime, false);
    var startRot = rotationProp.valueAtTime(startTime, false);

    // Determine end values
    var endPos = startPos;
    var endRot = startRot;

    if (action.endPosition) {
        endPos = [action.endPosition.x, action.endPosition.y];
    }
    if (action.endRotation !== undefined) {
        endRot = action.endRotation;
    }

    // Add Position keyframes
    positionProp.setValueAtTime(startTime, startPos);
    positionProp.setValueAtTime(endTime, endPos);

    // Add Rotation keyframes
    rotationProp.setValueAtTime(startTime, startRot);
    rotationProp.setValueAtTime(endTime, endRot);

    // Apply Bezier interpolation for smooth motion
    applyBezierEasing(positionProp);
    applyBezierEasing(rotationProp);
}

/**
 * Process FLIP effect (card flip using Scale X)
 * Scale X: 100 -> 0 -> -100 (simulates 180° Y rotation)
 * @param {Layer} layer - Target layer
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 */
function processFlipEffect(layer, startTime, duration) {
    var scaleProp = layer.property("Scale");

    // Calculate timing
    var midTime = startTime + duration * 0.5;
    var endTime = startTime + duration;

    // Get current scale values
    var currentScale = scaleProp.valueAtTime(startTime, false);
    var scaleY = currentScale[1];
    var scaleX = Math.abs(currentScale[0]);

    // Create flip animation: 100 -> 0 -> -100 on X axis
    // This simulates a card flipping over (backface visible)
    scaleProp.setValueAtTime(startTime, [scaleX, scaleY]);
    scaleProp.setValueAtTime(midTime, [0, scaleY]);         // Card edge-on
    scaleProp.setValueAtTime(endTime, [-scaleX, scaleY]);   // Card flipped (negative = mirrored)

    // Apply easing
    applyBezierEasing(scaleProp);
}

/**
 * Process SLAM effect (overshoot scale bounce)
 * Scale: [100,100] -> [130,130] -> [100,100] in ~5 frames
 * @param {Layer} layer - Target layer
 * @param {number} startTime - Start time (when card arrives)
 * @param {number} duration - Step duration
 * @param {CompItem} comp - Parent composition
 */
function processSlamEffect(layer, startTime, duration, comp) {
    var scaleProp = layer.property("Scale");
    var frameRate = comp.frameRate || FRAME_RATE;
    var frameDuration = 1 / frameRate;

    // Slam happens at the END of the movement (when card lands)
    var slamStartTime = startTime + duration;
    var slamMidTime = slamStartTime + (SLAM_DURATION_FRAMES * 0.5 * frameDuration);
    var slamEndTime = slamStartTime + (SLAM_DURATION_FRAMES * frameDuration);

    // Get current scale
    var currentScale = scaleProp.valueAtTime(slamStartTime, false);
    var baseScaleX = currentScale[0];
    var baseScaleY = currentScale[1];

    // Overshoot values (130% of current)
    var overshootFactor = SLAM_OVERSHOOT_SCALE / 100;
    var overshootScaleX = baseScaleX * overshootFactor;
    var overshootScaleY = baseScaleY * overshootFactor;

    // Create slam bounce keyframes
    scaleProp.setValueAtTime(slamStartTime, [baseScaleX, baseScaleY]);
    scaleProp.setValueAtTime(slamMidTime, [overshootScaleX, overshootScaleY]);
    scaleProp.setValueAtTime(slamEndTime, [baseScaleX, baseScaleY]);

    // Apply bounce easing (fast out, bounce back)
    applyBounceEasing(scaleProp, slamStartTime);

    // Enable Motion Blur for this layer
    layer.motionBlur = true;
}

// ============================================
// EASING FUNCTIONS
// ============================================

/**
 * Apply Bezier (smooth) easing to all keyframes
 * @param {Property} property - The property to ease
 */
function applyBezierEasing(property) {
    var numKeys = property.numKeys;
    if (numKeys < 2) return;

    for (var k = 1; k <= numKeys; k++) {
        try {
            // Set keyframe interpolation to Bezier
            property.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

            // Create smooth ease (influence: 33%, speed: 0)
            var easeIn = [];
            var easeOut = [];
            var dims = getDimensionCount(property);

            for (var d = 0; d < dims; d++) {
                easeIn.push(new KeyframeEase(0, 33));   // Speed 0, Influence 33%
                easeOut.push(new KeyframeEase(0, 33));
            }

            if (dims === 1) {
                property.setTemporalEaseAtKey(k, [easeIn[0]], [easeOut[0]]);
            } else {
                property.setTemporalEaseAtKey(k, easeIn, easeOut);
            }
        } catch (e) {
            // Some properties may not support easing
            $.writeln("Easing warning: " + e.toString());
        }
    }
}

/**
 * Apply bounce easing for slam effect
 * @param {Property} property - The property to ease
 * @param {number} slamStartTime - When slam starts
 */
function applyBounceEasing(property, slamStartTime) {
    var numKeys = property.numKeys;
    if (numKeys < 2) return;

    // Find keyframes near slam time and apply quick bounce easing
    for (var k = 1; k <= numKeys; k++) {
        var keyTime = property.keyTime(k);

        // Only affect slam keyframes (within 0.2s of slam start)
        if (Math.abs(keyTime - slamStartTime) < 0.2) {
            try {
                property.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

                var dims = getDimensionCount(property);
                var easeIn = [];
                var easeOut = [];

                // Fast acceleration, quick bounce back
                for (var d = 0; d < dims; d++) {
                    easeIn.push(new KeyframeEase(0, 75));   // Strong influence
                    easeOut.push(new KeyframeEase(0, 75));
                }

                if (dims === 1) {
                    property.setTemporalEaseAtKey(k, [easeIn[0]], [easeOut[0]]);
                } else {
                    property.setTemporalEaseAtKey(k, easeIn, easeOut);
                }
            } catch (e) {
                // Ignore easing errors
            }
        }
    }
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate total duration from scenario steps
 * @param {array} scenario - Array of step objects
 * @returns {number} Total duration in seconds
 */
function calculateTotalDuration(scenario) {
    var total = 0;
    for (var i = 0; i < scenario.length; i++) {
        total += scenario[i].duration || 1.0;
    }
    return total;
}

/**
 * Normalize asset root path
 * @param {string} path - Input path
 * @returns {string} Normalized path
 */
function normalizeAssetPath(path) {
    if (!path) return "";

    // Remove file:// prefix if present
    path = path.replace(/^file:\/\//, "");

    // Normalize slashes for current OS
    if ($.os.indexOf("Windows") !== -1) {
        path = path.replace(/\//g, "\\");
    } else {
        path = path.replace(/\\/g, "/");
    }

    // Ensure trailing slash
    if (path.length > 0 && path.charAt(path.length - 1) !== "/" && path.charAt(path.length - 1) !== "\\") {
        path += ($.os.indexOf("Windows") !== -1) ? "\\" : "/";
    }

    return path;
}

/**
 * Resolve full asset path from relative path
 * @param {string} assetPath - Asset path (may be relative or absolute)
 * @param {string} rootPath - Root assets folder
 * @returns {string|null} Full resolved path or null
 */
function resolveAssetPath(assetPath, rootPath) {
    if (!assetPath) return null;

    // Remove file:// and blob: prefixes
    assetPath = assetPath.replace(/^file:\/\//, "");
    if (assetPath.indexOf("blob:") === 0) return null;

    // Check if already absolute path
    var isAbsolute = false;
    if ($.os.indexOf("Windows") !== -1) {
        isAbsolute = /^[A-Za-z]:[\\/]/.test(assetPath);
    } else {
        isAbsolute = assetPath.charAt(0) === "/";
    }

    if (isAbsolute) {
        return assetPath;
    }

    // Combine with root path
    if (rootPath) {
        return rootPath + assetPath;
    }

    return assetPath;
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
            positionProp.setValueAtTime(kf.time, [kf.x || 0, kf.y || 0]);
            rotationProp.setValueAtTime(kf.time, kf.rotation || 0);
        }

        applyBezierEasing(positionProp);
        applyBezierEasing(rotationProp);
    }

    layer.property("Scale").setValue([100, 100]);
    return layer;
}
