// Autonim-Poker - ExtendScript Host Script
// This script runs in After Effects and handles scenario import

/**
 * Import poker scenario from the Director Tool
 * Called from the CEP panel
 * @param {string} jsonString - JSON string containing scenario data
 * @returns {string} JSON string with result
 */
function importPokerScenario(jsonString) {
    try {
        // Parse input data
        var data = JSON.parse(jsonString);
        var projectInfo = data.projectInfo || { width: 1920, height: 1080, fps: 30 };
        var initialState = data.initialState || {};
        var scenario = data.scenario || [];

        if (scenario.length === 0) {
            return JSON.stringify({
                success: false,
                message: "No steps in scenario"
            });
        }

        // Start undo group
        app.beginUndoGroup("Autonim-Poker: Import Scenario");

        // Calculate total duration from all steps
        var totalDuration = 0;
        for (var i = 0; i < scenario.length; i++) {
            totalDuration += scenario[i].duration || 1.0;
        }
        totalDuration = Math.max(totalDuration + 1.0, 5.0); // Add buffer

        // Create new composition
        var compName = "Poker_Scene_" + new Date().getTime();
        var comp = app.project.items.addComp(
            compName,
            projectInfo.width,
            projectInfo.height,
            1.0,
            totalDuration,
            projectInfo.fps
        );

        // Create layers for each card in initial state
        var layers = {};
        var layerIndex = 1;

        for (var cardId in initialState) {
            if (initialState.hasOwnProperty(cardId)) {
                var cardInfo = initialState[cardId];
                var layer = createCardLayer(comp, cardId, cardInfo, layerIndex);
                layers[cardId] = layer;
                layerIndex++;
            }
        }

        // Apply scenario steps
        var currentTime = 0;
        for (var s = 0; s < scenario.length; s++) {
            var step = scenario[s];
            var stepDuration = step.duration || 1.0;
            var actions = step.actions || [];

            applyStepActions(comp, layers, actions, currentTime, stepDuration);
            currentTime += stepDuration;
        }

        // End undo group
        app.endUndoGroup();

        // Return success
        return JSON.stringify({
            success: true,
            message: "Created " + compName + " with " + scenario.length + " steps",
            compName: compName
        });

    } catch (error) {
        // End undo group on error
        app.endUndoGroup();

        // Return error
        return JSON.stringify({
            success: false,
            message: "Error: " + error.toString()
        });
    }
}

/**
 * Create a card layer from initial state
 */
function createCardLayer(comp, cardId, cardInfo, index) {
    var layer = null;
    var cardPath = cardInfo.path || "";
    var cardName = cardInfo.name || cardId;

    // Try to import the image file
    var cardFile = null;
    if (cardPath && cardPath.indexOf("file://") === 0) {
        cardPath = cardPath.replace("file://", "");
    }
    if (cardPath && cardPath.indexOf("blob:") !== 0) {
        cardFile = new File(cardPath);
    }

    if (cardFile && cardFile.exists) {
        // Import the file as footage
        var importOptions = new ImportOptions(cardFile);
        var footage = app.project.importFile(importOptions);

        // Add to composition
        layer = comp.layers.add(footage);
        layer.name = cardName;
    } else {
        // Create placeholder shape layer
        layer = createPlaceholderCard(comp, cardName);
    }

    // Set initial transform
    var posX = cardInfo.x || comp.width / 2;
    var posY = cardInfo.y || comp.height / 2;
    var rotation = cardInfo.rotation || 0;
    var scale = (cardInfo.scale || 1) * 100;

    layer.property("Position").setValue([posX, posY]);
    layer.property("Rotation").setValue(rotation);
    layer.property("Scale").setValue([scale, scale]);

    // Set anchor point to center
    layer.property("Anchor Point").setValue([layer.width / 2, layer.height / 2]);

    return layer;
}

/**
 * Apply step actions to layers
 */
function applyStepActions(comp, layers, actions, startTime, duration) {
    for (var a = 0; a < actions.length; a++) {
        var action = actions[a];
        var layer = layers[action.targetId];

        if (!layer) continue;

        var endTime = startTime + duration;

        // Get properties
        var positionProp = layer.property("Position");
        var rotationProp = layer.property("Rotation");
        var scaleProp = layer.property("Scale");

        // Get current values at start time
        var startPos = positionProp.valueAtTime(startTime, false);
        var startRot = rotationProp.valueAtTime(startTime, false);
        var startScale = scaleProp.valueAtTime(startTime, false);

        // End values from action
        var endPos = [action.endPosition.x, action.endPosition.y];
        var endRot = action.endRotation || startRot;

        // Set keyframes for position
        positionProp.setValueAtTime(startTime, startPos);
        positionProp.setValueAtTime(endTime, endPos);

        // Set keyframes for rotation
        if (action.endRotation !== undefined) {
            rotationProp.setValueAtTime(startTime, startRot);
            rotationProp.setValueAtTime(endTime, endRot);
        }

        // Handle SLAM effect (overshoot scale)
        if (action.effect === "SLAM") {
            var slamMidTime = startTime + duration * 0.7;
            var slamScale = [startScale[0] * 1.3, startScale[1] * 1.3]; // 130% overshoot

            scaleProp.setValueAtTime(startTime, startScale);
            scaleProp.setValueAtTime(slamMidTime, slamScale);
            scaleProp.setValueAtTime(endTime, startScale);

            // Add easing for slam
            applyEaseToKeyframes(scaleProp);
        }

        // Handle FLIP effect
        if (action.flip) {
            // Create scale X animation for flip (3D flip simulation)
            var flipMidTime = startTime + duration * 0.5;

            scaleProp.setValueAtTime(startTime, startScale);
            scaleProp.setValueAtTime(flipMidTime, [0, startScale[1]]); // Scale X to 0
            scaleProp.setValueAtTime(endTime, startScale);

            applyEaseToKeyframes(scaleProp);
        }

        // Apply ease to position keyframes
        applyEaseToKeyframes(positionProp);
        applyEaseToKeyframes(rotationProp);
    }
}

/**
 * Apply ease to all keyframes of a property
 */
function applyEaseToKeyframes(property) {
    var numKeys = property.numKeys;
    if (numKeys < 2) return;

    for (var k = 1; k <= numKeys; k++) {
        try {
            var easeIn = [];
            var easeOut = [];
            var dims = property.value.length || 1;

            for (var d = 0; d < dims; d++) {
                easeIn.push(new KeyframeEase(0, 50));
                easeOut.push(new KeyframeEase(0, 50));
            }

            if (dims === 1) {
                property.setTemporalEaseAtKey(k, [easeIn[0]], [easeOut[0]]);
            } else {
                property.setTemporalEaseAtKey(k, easeIn, easeOut);
            }
        } catch (e) {
            // Some properties may not support easing
        }
    }
}

/**
 * Create a placeholder card shape if image file not found
 */
function createPlaceholderCard(comp, name) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = name;

    var cardWidth = 80;
    var cardHeight = 112;

    // Add rectangle
    var shapeGroup = shapeLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    shapeGroup.name = "Card Shape";

    var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);
    rect.property("ADBE Vector Rect Roundness").setValue(8);

    // Add fill
    var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue([0.95, 0.95, 0.95, 1]);

    // Add stroke
    var stroke = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue([0.2, 0.2, 0.2, 1]);
    stroke.property("ADBE Vector Stroke Width").setValue(2);

    return shapeLayer;
}

// ============================================
// LEGACY FUNCTIONS (Kept for backward compatibility)
// ============================================

/**
 * Import poker animation from recorded keyframe data (legacy)
 */
function importPokerAnimation(jsonString) {
    try {
        var data = JSON.parse(jsonString);
        var compName = data.compName || "Poker_Sequence_01";
        var frameRate = data.frameRate || 30;
        var tableWidth = data.tableWidth || 1920;
        var tableHeight = data.tableHeight || 1080;
        var layers = data.layers || [];

        if (layers.length === 0) {
            return JSON.stringify({
                success: false,
                message: "No layers to import"
            });
        }

        app.beginUndoGroup("Autonim-Poker: Import Animation");

        var compWidth = 1920;
        var compHeight = 1080;
        var maxDuration = 2.0;

        for (var i = 0; i < layers.length; i++) {
            var keyframes = layers[i].keyframes;
            if (keyframes && keyframes.length > 0) {
                var lastTime = keyframes[keyframes.length - 1].time;
                if (lastTime > maxDuration) {
                    maxDuration = lastTime + 0.5;
                }
            }
        }

        var comp = app.project.items.addComp(compName, compWidth, compHeight, 1.0, maxDuration, frameRate);
        var scaleX = compWidth / tableWidth;
        var scaleY = compHeight / tableHeight;

        for (var j = 0; j < layers.length; j++) {
            var layerData = layers[j];
            importCardLayerLegacy(comp, layerData, scaleX, scaleY, compWidth, compHeight, tableWidth, tableHeight);
        }

        app.endUndoGroup();

        return JSON.stringify({
            success: true,
            message: "Imported " + layers.length + " layers to " + compName,
            compName: compName
        });

    } catch (error) {
        app.endUndoGroup();
        return JSON.stringify({
            success: false,
            message: "Error: " + error.toString()
        });
    }
}

function importCardLayerLegacy(comp, layerData, scaleX, scaleY, compWidth, compHeight, tableWidth, tableHeight) {
    var cardPath = layerData.path;
    var cardName = layerData.name;
    var keyframes = layerData.keyframes || [];

    var cardFile = new File(cardPath);
    var cardLayer = null;

    if (cardFile.exists) {
        var importOptions = new ImportOptions(cardFile);
        var footage = app.project.importFile(importOptions);
        cardLayer = comp.layers.add(footage);
        cardLayer.name = cardName;
    } else {
        cardLayer = createPlaceholderCard(comp, cardName);
    }

    if (keyframes.length > 0) {
        var firstKf = keyframes[0];
        var pos = [(firstKf.x / tableWidth) * compWidth, (firstKf.y / tableHeight) * compHeight];
        cardLayer.property("Position").setValue(pos);

        if (firstKf.rotation !== undefined) {
            cardLayer.property("Rotation").setValue(firstKf.rotation);
        }
    }

    if (keyframes.length > 1) {
        var positionProp = cardLayer.property("Position");
        var rotationProp = cardLayer.property("Rotation");

        for (var i = 0; i < keyframes.length; i++) {
            var kf = keyframes[i];
            var pos = [(kf.x / tableWidth) * compWidth, (kf.y / tableHeight) * compHeight];

            positionProp.setValueAtTime(kf.time, pos);
            rotationProp.setValueAtTime(kf.time, kf.rotation || 0);
        }

        applyEaseToKeyframes(positionProp);
        applyEaseToKeyframes(rotationProp);
    }

    cardLayer.property("Scale").setValue([50, 50]);

    return cardLayer;
}

/**
 * Generate preset poker animations (legacy)
 */
function generatePokerAnimation(dataJSON) {
    try {
        var data = JSON.parse(dataJSON);
        var animType = data.type;
        var duration = data.duration;
        var cardCount = data.cardCount;

        app.beginUndoGroup("Autonim-Poker: " + animType);

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = app.project.items.addComp("Poker Animation", 1920, 1080, 1.0, 10.0, 30);
        }

        switch (animType) {
            case 'deal':
                createDealAnimation(comp, duration, cardCount);
                break;
            case 'flip':
                createFlipAnimation(comp, duration, cardCount);
                break;
            case 'shuffle':
                createShuffleAnimation(comp, duration, cardCount);
                break;
            case 'collect':
                createCollectAnimation(comp, duration, cardCount);
                break;
        }

        app.endUndoGroup();

        return JSON.stringify({
            success: true,
            message: "Created " + animType + " animation with " + cardCount + " cards"
        });

    } catch (error) {
        app.endUndoGroup();
        return JSON.stringify({
            success: false,
            message: "Error: " + error.toString()
        });
    }
}

function createDealAnimation(comp, duration, cardCount) {
    var spacing = 100;
    var startX = (comp.width - (cardCount * spacing)) / 2 + 50;
    var startY = comp.height / 2;

    for (var i = 0; i < cardCount; i++) {
        var card = createPlaceholderCard(comp, "Card " + (i + 1));
        var finalX = startX + (i * spacing);

        var position = card.property("Position");
        position.setValueAtTime(0, [comp.width / 2, comp.height / 2]);
        position.setValueAtTime(duration * (i + 1) / cardCount, [finalX, startY]);

        applyEaseToKeyframes(position);
    }
}

function createFlipAnimation(comp, duration, cardCount) {
    var spacing = 100;
    var startX = (comp.width - (cardCount * spacing)) / 2 + 50;

    for (var i = 0; i < cardCount; i++) {
        var card = createPlaceholderCard(comp, "Card " + (i + 1));
        card.property("Position").setValue([startX + (i * spacing), comp.height / 2]);

        var scale = card.property("Scale");
        var flipStart = duration * i / cardCount;
        var flipMid = flipStart + (duration / cardCount) * 0.5;
        var flipEnd = flipStart + (duration / cardCount);

        scale.setValueAtTime(flipStart, [100, 100]);
        scale.setValueAtTime(flipMid, [0, 100]);
        scale.setValueAtTime(flipEnd, [100, 100]);
    }
}

function createShuffleAnimation(comp, duration, cardCount) {
    for (var i = 0; i < cardCount; i++) {
        var card = createPlaceholderCard(comp, "Card " + (i + 1));
        var position = card.property("Position");
        var centerX = comp.width / 2;
        var centerY = comp.height / 2;

        position.setValueAtTime(0, [centerX, centerY]);

        for (var j = 1; j <= 5; j++) {
            var t = duration * j / 5;
            var x = centerX + (Math.random() - 0.5) * 400;
            var y = centerY + (Math.random() - 0.5) * 300;
            position.setValueAtTime(t, [x, y]);
        }
    }
}

function createCollectAnimation(comp, duration, cardCount) {
    var spacing = 100;
    var startX = (comp.width - (cardCount * spacing)) / 2 + 50;

    for (var i = 0; i < cardCount; i++) {
        var card = createPlaceholderCard(comp, "Card " + (i + 1));
        var position = card.property("Position");

        position.setValueAtTime(0, [startX + (i * spacing), comp.height / 2]);
        position.setValueAtTime(duration, [comp.width / 2, comp.height / 2]);

        applyEaseToKeyframes(position);
    }
}
