// Autonim-Poker - ExtendScript Host Script
// This script runs in After Effects and handles animation import

/**
 * Import poker animation from recorded keyframe data
 * Called from the CEP panel
 * @param {string} jsonString - JSON string containing animation data
 * @returns {string} JSON string with result
 */
function importPokerAnimation(jsonString) {
    try {
        // Parse input data
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

        // Start undo group
        app.beginUndoGroup("Autonim-Poker: Import Animation");

        // Create new composition
        var compWidth = 1920;
        var compHeight = 1080;
        var pixelAspect = 1.0;

        // Calculate duration from longest keyframe sequence
        var maxDuration = 2.0; // Minimum 2 seconds
        for (var i = 0; i < layers.length; i++) {
            var keyframes = layers[i].keyframes;
            if (keyframes && keyframes.length > 0) {
                var lastTime = keyframes[keyframes.length - 1].time;
                if (lastTime > maxDuration) {
                    maxDuration = lastTime + 0.5; // Add buffer
                }
            }
        }

        // Create composition
        var comp = app.project.items.addComp(compName, compWidth, compHeight, pixelAspect, maxDuration, frameRate);

        // Calculate scale factor to map table coordinates to comp
        var scaleX = compWidth / tableWidth;
        var scaleY = compHeight / tableHeight;
        var scale = Math.min(scaleX, scaleY);

        // Import each layer
        for (var j = 0; j < layers.length; j++) {
            var layerData = layers[j];
            importCardLayer(comp, layerData, scale, compWidth, compHeight, tableWidth, tableHeight);
        }

        // End undo group
        app.endUndoGroup();

        // Return success
        return JSON.stringify({
            success: true,
            message: "Imported " + layers.length + " layers to " + compName,
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
 * Import a single card layer with keyframes
 */
function importCardLayer(comp, layerData, scale, compWidth, compHeight, tableWidth, tableHeight) {
    var cardPath = layerData.path;
    var cardName = layerData.name;
    var keyframes = layerData.keyframes || [];

    // Try to import the image file
    var cardFile = new File(cardPath);
    var cardLayer = null;

    if (cardFile.exists) {
        // Import the file as footage
        var importOptions = new ImportOptions(cardFile);
        var footage = app.project.importFile(importOptions);

        // Add to composition
        cardLayer = comp.layers.add(footage);
        cardLayer.name = cardName;
    } else {
        // If file doesn't exist, create a placeholder shape
        cardLayer = createPlaceholderCard(comp, cardName);
    }

    // Set initial position
    if (keyframes.length > 0) {
        var firstKf = keyframes[0];
        var pos = transformPosition(firstKf.x, firstKf.y, scale, compWidth, compHeight, tableWidth, tableHeight);
        cardLayer.property("Position").setValue([pos[0], pos[1]]);

        if (firstKf.rotation !== undefined) {
            cardLayer.property("Rotation").setValue(firstKf.rotation);
        }
    }

    // Apply keyframes if more than one
    if (keyframes.length > 1) {
        applyKeyframes(cardLayer, keyframes, scale, compWidth, compHeight, tableWidth, tableHeight);
    }

    // Scale down the card to a reasonable size
    cardLayer.property("Scale").setValue([50, 50]);

    return cardLayer;
}

/**
 * Apply keyframe animation to layer
 */
function applyKeyframes(layer, keyframes, scale, compWidth, compHeight, tableWidth, tableHeight) {
    var positionProp = layer.property("Position");
    var rotationProp = layer.property("Rotation");

    // Enable keyframes
    positionProp.setValueAtTime(0, positionProp.value);
    rotationProp.setValueAtTime(0, rotationProp.value);

    // Add each keyframe
    for (var i = 0; i < keyframes.length; i++) {
        var kf = keyframes[i];
        var time = kf.time;
        var pos = transformPosition(kf.x, kf.y, scale, compWidth, compHeight, tableWidth, tableHeight);

        positionProp.setValueAtTime(time, [pos[0], pos[1]]);
        rotationProp.setValueAtTime(time, kf.rotation || 0);
    }

    // Apply easing to position keyframes
    var numPosKeys = positionProp.numKeys;
    if (numPosKeys > 1) {
        for (var k = 1; k <= numPosKeys; k++) {
            var easeIn = new KeyframeEase(0, 33);
            var easeOut = new KeyframeEase(0, 33);
            positionProp.setTemporalEaseAtKey(k, [easeIn, easeIn], [easeOut, easeOut]);
        }
    }

    // Apply easing to rotation keyframes
    var numRotKeys = rotationProp.numKeys;
    if (numRotKeys > 1) {
        for (var r = 1; r <= numRotKeys; r++) {
            var rotEaseIn = new KeyframeEase(0, 33);
            var rotEaseOut = new KeyframeEase(0, 33);
            rotationProp.setTemporalEaseAtKey(r, [rotEaseIn], [rotEaseOut]);
        }
    }
}

/**
 * Transform position from panel coordinates to composition coordinates
 */
function transformPosition(x, y, scale, compWidth, compHeight, tableWidth, tableHeight) {
    // Map panel coordinates to composition coordinates
    var compX = (x / tableWidth) * compWidth;
    var compY = (y / tableHeight) * compHeight;

    return [compX, compY];
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
    fill.property("ADBE Vector Fill Color").setValue([0.9, 0.9, 0.9, 1]);

    // Add stroke
    var stroke = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue([0.2, 0.2, 0.2, 1]);
    stroke.property("ADBE Vector Stroke Width").setValue(2);

    return shapeLayer;
}

/**
 * Legacy function for generating preset poker animations
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
            comp = createNewComposition();
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
            default:
                throw new Error("Unknown animation type: " + animType);
        }

        app.endUndoGroup();

        return JSON.stringify({
            success: true,
            message: "Successfully created " + animType + " animation with " + cardCount + " cards"
        });

    } catch (error) {
        app.endUndoGroup();
        return JSON.stringify({
            success: false,
            message: "Error: " + error.toString()
        });
    }
}

/**
 * Create a new composition
 */
function createNewComposition() {
    var compName = "Poker Animation " + new Date().getTime();
    var width = 1920;
    var height = 1080;
    var pixelAspect = 1.0;
    var duration = 10.0;
    var frameRate = 30;

    return app.project.items.addComp(compName, width, height, pixelAspect, duration, frameRate);
}

/**
 * Create Deal Cards animation
 */
function createDealAnimation(comp, duration, cardCount) {
    var cardWidth = 100;
    var cardHeight = 140;
    var spacing = 120;
    var startX = (comp.width - (cardCount * spacing - 20)) / 2;
    var startY = comp.height / 2;

    for (var i = 0; i < cardCount; i++) {
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        var shapeGroup = card.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        shapeGroup.name = "Card Shape";

        var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);
        rect.property("ADBE Vector Rect Roundness").setValue(10);

        var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);

        var stroke = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Color").setValue([0, 0, 0, 1]);
        stroke.property("ADBE Vector Stroke Width").setValue(3);

        var finalX = startX + (i * spacing);
        var finalY = startY;

        var position = card.property("ADBE Transform Group").property("ADBE Position");
        position.setValueAtTime(0, [comp.width / 2, comp.height / 2]);
        position.setValueAtTime(duration * (i + 1) / cardCount, [finalX, finalY]);

        var keyIndex = position.numKeys;
        position.setTemporalEaseAtKey(keyIndex, [new KeyframeEase(0, 75)], [new KeyframeEase(0, 75)]);
    }
}

/**
 * Create Flip Cards animation
 */
function createFlipAnimation(comp, duration, cardCount) {
    var cardWidth = 100;
    var cardHeight = 140;
    var spacing = 120;
    var startX = (comp.width - (cardCount * spacing - 20)) / 2;
    var startY = comp.height / 2;

    for (var i = 0; i < cardCount; i++) {
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        var shapeGroup = card.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);
        rect.property("ADBE Vector Rect Roundness").setValue(10);

        var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([0.8, 0.2, 0.2, 1]);

        card.property("ADBE Transform Group").property("ADBE Position").setValue([startX + (i * spacing), startY]);

        var rotationY = card.property("ADBE Transform Group").property("ADBE Rotate Y");
        var flipStart = duration * i / cardCount;
        var flipEnd = flipStart + (duration / cardCount);

        rotationY.setValueAtTime(flipStart, 0);
        rotationY.setValueAtTime(flipEnd, 180);
    }
}

/**
 * Create Shuffle animation
 */
function createShuffleAnimation(comp, duration, cardCount) {
    var cardWidth = 100;
    var cardHeight = 140;

    for (var i = 0; i < cardCount; i++) {
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        var shapeGroup = card.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);

        var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([Math.random(), Math.random(), Math.random(), 1]);

        var position = card.property("ADBE Transform Group").property("ADBE Position");
        var startX = comp.width / 2;
        var startY = comp.height / 2;

        position.setValueAtTime(0, [startX, startY]);

        for (var j = 1; j <= 5; j++) {
            var t = duration * j / 5;
            var x = startX + (Math.random() - 0.5) * 400;
            var y = startY + (Math.random() - 0.5) * 400;
            position.setValueAtTime(t, [x, y]);
        }
    }
}

/**
 * Create Collect Cards animation
 */
function createCollectAnimation(comp, duration, cardCount) {
    var cardWidth = 100;
    var cardHeight = 140;
    var spacing = 120;
    var startX = (comp.width - (cardCount * spacing - 20)) / 2;
    var startY = comp.height / 2;

    for (var i = 0; i < cardCount; i++) {
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        var shapeGroup = card.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);

        var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([0.2, 0.8, 0.2, 1]);

        var position = card.property("ADBE Transform Group").property("ADBE Position");
        position.setValueAtTime(0, [startX + (i * spacing), startY]);
        position.setValueAtTime(duration, [comp.width / 2, comp.height / 2]);

        var keyIndex = position.numKeys;
        position.setTemporalEaseAtKey(keyIndex, [new KeyframeEase(0, 75)], [new KeyframeEase(0, 75)]);
    }
}
