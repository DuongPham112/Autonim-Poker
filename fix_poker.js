const fs = require('fs');

const mainJsPath = 'client/js/main.js';
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

const startStr = "function loadPokerLayout() {";
const nextFuncMatch = mainJs.match(/\/\*\*[\s\S]*?function loadPusoyLayout/);
if (!nextFuncMatch) {
    console.error("Could not find loadPusoyLayout");
    process.exit(1);
}

const startIndex = mainJs.indexOf(startStr);
const endIndex = nextFuncMatch.index;

if (startIndex === -1) {
    console.error("Could not find loadPokerLayout");
    process.exit(1);
}

const newCode = `function generateArrayHand(zoneName, packIndex) {
    var places = [];
    var spacing = 45;
    var labelPrefix = zoneName.charAt(0).toUpperCase();

    var startX = 0, startY = 0;
    var isVertical = false;
    var rotation = 0;

    if (zoneName === 'bottom') {
        startX = (UI_WIDTH / 2) - (6 * spacing);
        startY = UI_HEIGHT - 80;
    } else if (zoneName === 'left') {
        startX = 120;
        startY = 130;
        isVertical = true;
        rotation = 90;
    } else if (zoneName === 'top') {
        startX = (UI_WIDTH / 2) - (6 * spacing);
        startY = 80;
    } else if (zoneName === 'right') {
        startX = UI_WIDTH - 120;
        startY = 130;
        isVertical = true;
        rotation = -90;
    }

    var zOrderBase = packIndex * 100;
    
    for (var i = 0; i < 13; i++) {
        places.push({
            id: 'array-' + zoneName + '-' + i,
            zone: zoneName,
            x: isVertical ? startX : startX + (i * spacing),
            y: isVertical ? startY + (i * spacing) : startY,
            rotation: rotation,
            zOrder: zOrderBase + i,
            label: labelPrefix + (i + 1)
        });
    }

    var slotIds = places.map(function(p) { return p.id; });
    var groupName = 'Array ' + zoneName.charAt(0).toUpperCase() + zoneName.slice(1);
    var group = {
        id: 'array-' + zoneName,
        name: groupName,
        slotIds: slotIds,
        groupOrder: packIndex,
        color: getGroupColor(packIndex % 8)
    };

    return { places: places, group: group };
}

function loadPokerLayout() {
    appState.cardPlaces = [];
    appState.boardLayout = {
        type: 'grid',
        name: 'Array (4 Players)',
        boardStyle: 'poker',
        gridCols: 13,
        gridRows: 4,
        cardPlaces: [],
        slotGroups: []
    };

    var bottomPack = generateArrayHand('bottom', 0);
    bottomPack.places.forEach(function(p) {
        appState.boardLayout.cardPlaces.push(p);
    });
    appState.boardLayout.slotGroups.push(bottomPack.group);
    
    gameContainer.classList.add('grid-mode');
    
    if (typeof refreshUIState === 'function') refreshUIState();
    if (typeof renderCardDropZones === 'function') renderCardDropZones();
    if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
    setStatus('Loaded Array layout (Bottom row)');
}

`;

mainJs = mainJs.substring(0, startIndex) + newCode + mainJs.substring(endIndex);

fs.writeFileSync(mainJsPath, mainJs);
console.log("Successfully replaced loadPokerLayout");
