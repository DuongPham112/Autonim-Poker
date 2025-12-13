// Autonim_Poker - ExtendScript Host Script
// This script runs in After Effects and handles animation generation

/**
 * Main function to generate poker animations
 * Called from the CEP panel
 * @param {string} dataJSON - JSON string containing animation parameters
 * @returns {string} JSON string with result
 */
function generatePokerAnimation(dataJSON) {
    try {
        // Parse input data
        var data = JSON.parse(dataJSON);
        var animType = data.type;
        var duration = data.duration;
        var cardCount = data.cardCount;

        // Start undo group
        app.beginUndoGroup("Autonim_Poker: " + animType);

        // Get active composition or create new one
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = createNewComposition();
        }

        // Generate animation based on type
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

        // End undo group
        app.endUndoGroup();

        // Return success
        return JSON.stringify({
            success: true,
            message: "Successfully created " + animType + " animation with " + cardCount + " cards"
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
 * Create a new composition
 * @returns {CompItem} The newly created composition
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
        // Create card shape layer
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        // Add rectangle to shape layer
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

        // Set position
        var finalX = startX + (i * spacing);
        var finalY = startY;

        // Animate position (deal from center)
        var position = card.property("ADBE Transform Group").property("ADBE Position");
        position.setValueAtTime(0, [comp.width / 2, comp.height / 2]);
        position.setValueAtTime(duration * (i + 1) / cardCount, [finalX, finalY]);

        // Add ease
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
        // Create card shape layer
        var card = comp.layers.addShape();
        card.name = "Card " + (i + 1);

        // Add rectangle
        var shapeGroup = card.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var rect = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([cardWidth, cardHeight]);
        rect.property("ADBE Vector Rect Roundness").setValue(10);

        var fill = shapeGroup.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([0.8, 0.2, 0.2, 1]);

        // Set position
        card.property("ADBE Transform Group").property("ADBE Position").setValue([startX + (i * spacing), startY]);

        // Animate rotation Y (flip effect)
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

        // Random shuffle animation
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

        // Animate from spread position to center
        var position = card.property("ADBE Transform Group").property("ADBE Position");
        position.setValueAtTime(0, [startX + (i * spacing), startY]);
        position.setValueAtTime(duration, [comp.width / 2, comp.height / 2]);

        // Add ease
        var keyIndex = position.numKeys;
        position.setTemporalEaseAtKey(keyIndex, [new KeyframeEase(0, 75)], [new KeyframeEase(0, 75)]);
    }
}
