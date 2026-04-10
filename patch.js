const fs = require('fs');

const mainJsPath = 'client/js/main.js';
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// 1. Patch `togglePusoyControls`
const togglePusoyOld = `    const togglePusoyControls = () => {
        const isPusoy = presetSelect.value.startsWith('pusoy');
        pusoyControls.classList.toggle('hidden', !isPusoy);

        // Add Pusoy Pack: visible for both pusoy and custom presets
        const addPusoyPackSection = document.getElementById('addPusoyPackSection');
        if (addPusoyPackSection) {
            const showPack = isPusoy || presetSelect.value === 'custom';
            addPusoyPackSection.classList.toggle('hidden', !showPack);
        }
    };`;

const togglePusoyNew = `    const togglePusoyControls = () => {
        const isPusoy = presetSelect.value.startsWith('pusoy');
        const isPoker = presetSelect.value === 'poker';
        pusoyControls.classList.toggle('hidden', !isPusoy);

        // Add Spread Pack (Pusoy)
        const addPusoyPackSection = document.getElementById('addPusoyPackSection');
        if (addPusoyPackSection) {
            const showPack = isPusoy || presetSelect.value === 'custom';
            addPusoyPackSection.classList.toggle('hidden', !showPack);
        }

        // Add Array Pack
        const addArrayPackSection = document.getElementById('addArrayPackSection');
        if (addArrayPackSection) {
            const showArrayPack = isPoker || presetSelect.value === 'custom';
            addArrayPackSection.classList.toggle('hidden', !showArrayPack);
        }
    };`;

mainJs = mainJs.replace(togglePusoyOld, togglePusoyNew);

// 2. Add generateArrayHand and replace loadPokerLayout
const loadPokerLayoutRegex = /function loadPokerLayout\(\) \{[\s\S]*?\n\s*\}\n/m;
const newPokerLayoutCode = `function generateArrayHand(zoneName, packIndex) {
    const places = [];
    const spacing = 45;
    let labelPrefix = zoneName.charAt(0).toUpperCase();

    let startX = 0, startY = 0;
    let isVertical = false;
    let rotation = 0;

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

    const zOrderBase = packIndex * 100;
    
    for (let i = 0; i < 13; i++) {
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

    const slotIds = places.map(p => p.id);
    const groupName = 'Array ' + zoneName.charAt(0).toUpperCase() + zoneName.slice(1);
    const group = {
        id: 'array-' + zoneName,
        name: groupName,
        slotIds: slotIds,
        groupOrder: packIndex,
        color: getGroupColor(packIndex % 8)
    };

    return { places, group };
}

function loadPokerLayout() {
    appState.cardPlaces = [];
    appState.boardLayout = {
        type: 'grid',
        name: 'Poker (4 Players)',
        boardStyle: 'poker',
        gridCols: 13,
        gridRows: 4,
        cardPlaces: [],
        slotGroups: []
    };

    // First array pack (bottom)
    const bottomPack = generateArrayHand('bottom', 0);
    appState.boardLayout.cardPlaces.push(...bottomPack.places);
    appState.boardLayout.slotGroups.push(bottomPack.group);
    
    refreshUIState();
    if (typeof renderCardDropZones === 'function') renderCardDropZones();
    if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
    setStatus('Loaded Array layout (Bottom row)');
}
`;

mainJs = mainJs.replace(loadPokerLayoutRegex, newPokerLayoutCode);

fs.writeFileSync(mainJsPath, mainJs);
console.log("Patched main.js");

// 3. Patch board_tools.js
const boardToolsPath = 'client/js/modules/board_tools.js';
let boardTools = fs.readFileSync(boardToolsPath, 'utf8');

const eventListenerPatch = `    const addPusoyPackBtn = document.getElementById('addPusoyPackBtn');
    if (addPusoyPackBtn) {
        addPusoyPackBtn.addEventListener('click', handleAddPusoyPack);
    }`;

const eventListenerNew = `    const addPusoyPackBtn = document.getElementById('addPusoyPackBtn');
    if (addPusoyPackBtn) {
        addPusoyPackBtn.addEventListener('click', handleAddPusoyPack);
    }
    const addArrayPackBtn = document.getElementById('addArrayPackBtn');
    if (addArrayPackBtn) {
        addArrayPackBtn.addEventListener('click', handleAddArrayPack);
    }`;

boardTools = boardTools.replace(eventListenerPatch, eventListenerNew);

const addPusoyPackRegex = /(function handleAddPusoyPack\(\) \{[\s\S]*?\}\n)/;

const newArrayPackFunction = `
const ARRAY_PACK_ZONES = ['bottom', 'left', 'top', 'right'];

function handleAddArrayPack() {
    const existingPacks = (appState.boardLayout.slotGroups || [])
        .filter(g => g.id.startsWith('array-'));
    
    const packIndex = existingPacks.length;
    
    if (packIndex >= ARRAY_PACK_ZONES.length) {
        setStatus('Maximum 4 Array packs reached');
        return;
    }

    if (typeof pushBoardUndoSnapshot === 'function') pushBoardUndoSnapshot();

    const zoneName = ARRAY_PACK_ZONES[packIndex];
    if (typeof generateArrayHand === 'function') {
        const newPack = generateArrayHand(zoneName, packIndex);
        if (!appState.boardLayout.cardPlaces) appState.boardLayout.cardPlaces = [];
        if (!appState.boardLayout.slotGroups) appState.boardLayout.slotGroups = [];
        
        appState.boardLayout.cardPlaces.push(...newPack.places);
        appState.boardLayout.slotGroups.push(newPack.group);
        
        refreshUIState();
        if (typeof renderCardDropZones === 'function') renderCardDropZones();
        if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
        setStatus('Added Array pack: ' + zoneName);
    }
}
`;

boardTools = boardTools + newArrayPackFunction;
fs.writeFileSync(boardToolsPath, boardTools);
console.log("Patched board_tools.js");
