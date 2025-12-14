/**
 * Autonim-Poker - Director Tool v2.0
 * Card Tray, Player Zones, Face States, Flip Animation
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

// CSInterface for AE communication
let csInterface;
try {
    csInterface = new CSInterface();
} catch (e) {
    console.warn('CSInterface not available - running outside CEP');
    csInterface = null;
}

// Node.js modules (available in CEP with Node.js enabled)
let fs, nodePath;
try {
    fs = require('fs');
    nodePath = require('path');
} catch (e) {
    console.warn('Node.js modules not available');
    fs = null;
    nodePath = null;
}

// Project Constants
const PROJECT_INFO = {
    width: 1920,
    height: 1080,
    fps: 30
};

// Card dimensions
const CARD_WIDTH = 60;
const CARD_HEIGHT = 84;

// Standard 52-card deck
const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

// Application State
const appState = {
    phase: 'setup',               // 'setup' or 'record'
    deckPath: null,               // Path to deck folder
    assetsRootPath: null,         // Assets folder for AE
    backImagePath: null,          // Path to back.png

    // Card Tray
    trayCards: [],                // Cards in tray (not yet on table)

    // Table Cards
    tableCards: [],               // Cards placed on table
    selectedCard: null,           // Currently selected card

    // Recording
    isEditingStep: false,
    currentStepIndex: -1,

    // Settings
    cardOverlap: 25               // Overlap in pixels
};

// Scenario Data (for export)
const scenarioData = {
    projectInfo: PROJECT_INFO,
    initialState: {},
    scenario: []
};

// Recording state
let currentStep = null;
let startSnapshot = null;

// ============================================
// DOM ELEMENTS
// ============================================

// Tray Panel
let cardTrayList, trayCardCount, deckSelect, loadDeckBtn, cardSearch;
let suitFilterBtns;

// Main Content
let gameContainer, cardArea, tableInstructions;
let setupPhaseBtn, recordPhaseBtn, recordingIndicator, modeBadge;
let flipAllBtn, resetTableBtn, tableCardCount, stepCount;
let overlapSlider, overlapValue;

// Player Zones
let zoneTop, zoneBottom, zoneLeft, zoneRight, communityZone;
let playerZones = [];

// Director Panel
let directorPanel, stepControlsSection;
let selectAssetsFolderBtn, assetsPathDisplay;
let addStepBtn, finishStepBtn, stepDuration;
let currentStepNum, totalSteps, timelinePreview;
let noCardSelected, cardProperties, selectedCardName, cardFaceState;
let flipCardCheck, slamEffectCheck;
let cardPosX, cardPosY, cardRot;
let exportJsonBtn, exportToAEBtn;

// Status
let statusMessage;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

function init() {
    getDOMElements();
    bindEvents();

    // Try to auto-load default deck
    autoLoadDefaultDeck();

    updateUI();
    setStatus('Ready - Load a deck and setup your cards');
    console.log('Autonim-Poker v2.0 initialized');
}

function getDOMElements() {
    // Tray Panel
    cardTrayList = document.getElementById('cardTrayList');
    trayCardCount = document.getElementById('trayCardCount');
    deckSelect = document.getElementById('deckSelect');
    loadDeckBtn = document.getElementById('loadDeckBtn');
    cardSearch = document.getElementById('cardSearch');
    suitFilterBtns = document.querySelectorAll('.suit-btn');

    // Main Content
    gameContainer = document.getElementById('gameContainer');
    cardArea = document.getElementById('cardArea');
    tableInstructions = document.getElementById('tableInstructions');
    setupPhaseBtn = document.getElementById('setupPhaseBtn');
    recordPhaseBtn = document.getElementById('recordPhaseBtn');
    recordingIndicator = document.getElementById('recordingIndicator');
    modeBadge = document.getElementById('modeBadge');
    flipAllBtn = document.getElementById('flipAllBtn');
    resetTableBtn = document.getElementById('resetTableBtn');
    tableCardCount = document.getElementById('tableCardCount');
    stepCount = document.getElementById('stepCount');
    overlapSlider = document.getElementById('overlapSlider');
    overlapValue = document.getElementById('overlapValue');

    // Player Zones
    zoneTop = document.getElementById('zoneTop');
    zoneBottom = document.getElementById('zoneBottom');
    zoneLeft = document.getElementById('zoneLeft');
    zoneRight = document.getElementById('zoneRight');
    communityZone = document.getElementById('communityZone');
    playerZones = [zoneTop, zoneBottom, zoneLeft, zoneRight, communityZone];

    // Director Panel
    directorPanel = document.getElementById('directorPanel');
    stepControlsSection = document.getElementById('stepControlsSection');
    selectAssetsFolderBtn = document.getElementById('selectAssetsFolderBtn');
    assetsPathDisplay = document.getElementById('assetsPathDisplay');
    addStepBtn = document.getElementById('addStepBtn');
    finishStepBtn = document.getElementById('finishStepBtn');
    stepDuration = document.getElementById('stepDuration');
    currentStepNum = document.getElementById('currentStepNum');
    totalSteps = document.getElementById('totalSteps');
    timelinePreview = document.getElementById('timelinePreview');
    noCardSelected = document.getElementById('noCardSelected');
    cardProperties = document.getElementById('cardProperties');
    selectedCardName = document.getElementById('selectedCardName');
    cardFaceState = document.getElementById('cardFaceState');
    flipCardCheck = document.getElementById('flipCardCheck');
    slamEffectCheck = document.getElementById('slamEffectCheck');
    cardPosX = document.getElementById('cardPosX');
    cardPosY = document.getElementById('cardPosY');
    cardRot = document.getElementById('cardRot');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    exportToAEBtn = document.getElementById('exportToAEBtn');

    // Status
    statusMessage = document.getElementById('statusMessage');
}

function bindEvents() {
    // Deck loading
    loadDeckBtn.addEventListener('click', handleLoadDeck);

    // Search and filter
    cardSearch.addEventListener('input', filterTrayCards);
    suitFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => handleSuitFilter(btn));
    });

    // Phase switching
    setupPhaseBtn.addEventListener('click', () => setPhase('setup'));
    recordPhaseBtn.addEventListener('click', () => setPhase('record'));

    // Table controls
    flipAllBtn.addEventListener('click', handleFlipAll);
    resetTableBtn.addEventListener('click', handleResetTable);
    overlapSlider.addEventListener('input', handleOverlapChange);

    // Assets folder
    selectAssetsFolderBtn.addEventListener('click', handleSelectAssetsFolder);

    // Recording controls
    addStepBtn.addEventListener('click', handleAddStep);
    finishStepBtn.addEventListener('click', handleFinishStep);

    // Card properties
    flipCardCheck.addEventListener('change', handlePropertyChange);
    slamEffectCheck.addEventListener('change', handlePropertyChange);

    // Export
    exportJsonBtn.addEventListener('click', handleExportJSON);
    exportToAEBtn.addEventListener('click', handleExportToAE);

    // Zone drop targets
    setupZoneDropTargets();

    // Click on table to deselect
    cardArea.addEventListener('click', (e) => {
        if (e.target === cardArea) {
            deselectCard();
        }
    });
}

// ============================================
// PHASE MANAGEMENT
// ============================================

function setPhase(phase) {
    appState.phase = phase;

    if (phase === 'setup') {
        setupPhaseBtn.classList.add('active');
        recordPhaseBtn.classList.remove('active');
        modeBadge.textContent = 'SETUP';
        modeBadge.classList.remove('recording');
        stepControlsSection.classList.add('hidden');
    } else {
        recordPhaseBtn.classList.add('active');
        setupPhaseBtn.classList.remove('active');
        modeBadge.textContent = 'RECORD';
        modeBadge.classList.add('recording');
        stepControlsSection.classList.remove('hidden');

        // Save initial state when entering record phase
        saveInitialState();
    }

    updateUI();
}

// ============================================
// DECK LOADING
// ============================================

function autoLoadDefaultDeck() {
    // Try to find default deck in assets folder
    if (!csInterface) {
        // Browser mode - create placeholder cards
        createPlaceholderDeck();
        return;
    }

    // CEP mode - get extension path
    const extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    const defaultDeckPath = extPath + '/assets/decks/default';

    if (fs && fs.existsSync(defaultDeckPath)) {
        loadDeckFromPath(defaultDeckPath);
    } else {
        setStatus('Default deck not found. Use Load button to select a deck folder.');
        createPlaceholderDeck();
    }
}

function handleLoadDeck() {
    // Use CEP folder dialog if available
    if (typeof window.cep !== 'undefined' && window.cep.fs) {
        try {
            const result = window.cep.fs.showOpenDialogEx(
                false,    // allowMultipleSelection
                true,     // chooseDirectory
                'Select Deck Folder',
                '',       // initialPath
                []        // fileTypes
            );

            if (result.err === 0 && result.data && result.data.length > 0) {
                loadDeckFromPath(result.data[0]);
            }
        } catch (e) {
            console.error('Error opening folder dialog:', e);
            setStatus('Error selecting folder', 'error');
        }
    } else {
        // Browser fallback - use file input
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                loadDeckFromFiles(e.target.files);
            }
        });
        input.click();
    }
}

function loadDeckFromPath(folderPath) {
    if (!fs) {
        setStatus('File system not available', 'error');
        return;
    }

    try {
        const files = fs.readdirSync(folderPath);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            setStatus('No image files found in folder', 'error');
            return;
        }

        // Find back.png
        const backFile = imageFiles.find(f => f.toLowerCase() === 'back.png');
        if (backFile) {
            appState.backImagePath = folderPath + '/' + backFile;
        }

        // Store deck path
        appState.deckPath = folderPath;
        appState.assetsRootPath = folderPath + '/';

        // Create card data for each image (except back.png)
        const cardFiles = imageFiles.filter(f => f.toLowerCase() !== 'back.png');

        appState.trayCards = cardFiles.map((filename, index) => {
            const baseName = filename.replace(/\.[^.]+$/, '');
            return createCardData(index, filename, baseName, folderPath);
        });

        renderCardTray();
        updateAssetsDisplay();
        setStatus(`Loaded ${appState.trayCards.length} cards from deck`, 'success');

    } catch (e) {
        console.error('Error loading deck:', e);
        setStatus('Error loading deck: ' + e.message, 'error');
    }
}

function loadDeckFromFiles(files) {
    const imageFiles = Array.from(files).filter(f =>
        /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
        setStatus('No image files found', 'error');
        return;
    }

    // Find back.png
    const backFile = imageFiles.find(f => f.name.toLowerCase() === 'back.png');
    if (backFile) {
        appState.backImagePath = URL.createObjectURL(backFile);
    }

    // Get folder path from first file
    if (nodePath && imageFiles[0].path) {
        appState.deckPath = nodePath.dirname(imageFiles[0].path);
        appState.assetsRootPath = appState.deckPath + '/';
    }

    // Create card data
    const cardFiles = imageFiles.filter(f => f.name.toLowerCase() !== 'back.png');

    appState.trayCards = cardFiles.map((file, index) => {
        const baseName = file.name.replace(/\.[^.]+$/, '');
        return {
            id: `card-${index}-${baseName.replace(/\s+/g, '_')}`,
            name: baseName,
            filename: file.name,
            frontImageUrl: URL.createObjectURL(file),
            backImageUrl: appState.backImagePath || '',
            isFaceUp: false,
            inTray: true
        };
    });

    renderCardTray();
    updateAssetsDisplay();
    setStatus(`Loaded ${appState.trayCards.length} cards`, 'success');
}

function createPlaceholderDeck() {
    // Create 52 placeholder cards for browser testing
    appState.trayCards = [];
    let index = 0;

    for (const suit of SUITS) {
        for (const rank of RANKS) {
            const name = `${rank}_${suit}`;
            appState.trayCards.push({
                id: `card-${index}-${name}`,
                name: name,
                displayName: `${rank.charAt(0).toUpperCase() + rank.slice(1)} of ${suit}`,
                filename: `${name}.png`,
                frontImageUrl: '',  // Will show placeholder
                backImageUrl: '',
                suit: suit,
                rank: rank,
                isFaceUp: false,
                inTray: true
            });
            index++;
        }
    }

    renderCardTray();
}

function createCardData(index, filename, baseName, folderPath) {
    // Try to parse suit from filename
    let suit = 'unknown';
    let rank = baseName;

    for (const s of SUITS) {
        if (baseName.toLowerCase().includes(s)) {
            suit = s;
            rank = baseName.toLowerCase().replace(s, '').replace(/[_-]/g, '').trim();
            break;
        }
    }

    return {
        id: `card-${index}-${baseName.replace(/\s+/g, '_')}`,
        name: baseName,
        displayName: baseName.replace(/[_-]/g, ' '),
        filename: filename,
        frontImageUrl: `file://${folderPath}/${filename}`,
        backImageUrl: appState.backImagePath ? `file://${appState.backImagePath}` : '',
        suit: suit,
        rank: rank,
        isFaceUp: false,
        inTray: true
    };
}

// ============================================
// CARD TRAY
// ============================================

function renderCardTray() {
    cardTrayList.innerHTML = '';

    const cardsToShow = getFilteredTrayCards();

    if (cardsToShow.length === 0) {
        cardTrayList.innerHTML = '<div class="tray-loading"><p>No cards match filter</p></div>';
        return;
    }

    cardsToShow.forEach(card => {
        const cardEl = createTrayCardElement(card);
        cardTrayList.appendChild(cardEl);
    });

    trayCardCount.textContent = appState.trayCards.filter(c => c.inTray).length;
}

function createTrayCardElement(card) {
    const el = document.createElement('div');
    el.className = 'tray-card';
    el.dataset.cardId = card.id;
    el.draggable = true;

    // Card image
    const img = document.createElement('img');
    if (card.frontImageUrl) {
        img.src = card.frontImageUrl;
    } else {
        // Placeholder with suit symbol
        img.src = createPlaceholderCardImage(card);
    }
    img.alt = card.name;
    el.appendChild(img);

    // Card name
    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.textContent = card.displayName || card.name;
    el.appendChild(nameEl);

    // Drag events
    el.addEventListener('dragstart', (e) => handleTrayCardDragStart(e, card));
    el.addEventListener('dragend', handleTrayCardDragEnd);

    return el;
}

function createPlaceholderCardImage(card) {
    // Create simple SVG placeholder
    const suitSymbols = {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        unknown: '?'
    };
    const suitColors = {
        spades: '#2c3e50',
        hearts: '#e74c3c',
        diamonds: '#e74c3c',
        clubs: '#2c3e50',
        unknown: '#666'
    };

    const symbol = suitSymbols[card.suit] || '?';
    const color = suitColors[card.suit] || '#666';
    const rankDisplay = card.rank ? card.rank.charAt(0).toUpperCase() : '?';

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
            <rect width="40" height="56" fill="white" rx="3"/>
            <text x="5" y="15" font-size="12" fill="${color}">${rankDisplay}</text>
            <text x="20" y="35" font-size="18" text-anchor="middle" fill="${color}">${symbol}</text>
        </svg>
    `;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function getFilteredTrayCards() {
    const searchTerm = cardSearch.value.toLowerCase();
    const activeFilter = document.querySelector('.suit-btn.active');
    const suitFilter = activeFilter ? activeFilter.dataset.suit : 'all';

    return appState.trayCards.filter(card => {
        if (!card.inTray) return false;

        // Search filter
        if (searchTerm && !card.name.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Suit filter
        if (suitFilter !== 'all' && card.suit !== suitFilter) {
            return false;
        }

        return true;
    });
}

function filterTrayCards() {
    renderCardTray();
}

function handleSuitFilter(btn) {
    suitFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCardTray();
}

// ============================================
// DRAG & DROP FROM TRAY
// ============================================

function handleTrayCardDragStart(e, card) {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');

    // Highlight drop zones
    playerZones.forEach(zone => zone.classList.add('drag-target'));
}

function handleTrayCardDragEnd(e) {
    e.target.classList.remove('dragging');
    playerZones.forEach(zone => zone.classList.remove('drag-target', 'drag-over'));
}

function setupZoneDropTargets() {
    playerZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => handleZoneDrop(e, zone));
    });

    // Also allow dropping on the main card area
    cardArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    cardArea.addEventListener('drop', (e) => handleCardAreaDrop(e));
}

function handleZoneDrop(e, zone) {
    e.preventDefault();
    zone.classList.remove('drag-over');

    const cardId = e.dataTransfer.getData('text/plain');
    const card = appState.trayCards.find(c => c.id === cardId);

    if (!card || !card.inTray) return;

    // Get zone info
    const zoneName = zone.dataset.zone;
    const rotation = parseInt(zone.dataset.rotation) || 0;

    // Move card from tray to zone
    placeCardInZone(card, zoneName, rotation, zone);
}

function handleCardAreaDrop(e) {
    e.preventDefault();

    const cardId = e.dataTransfer.getData('text/plain');
    const card = appState.trayCards.find(c => c.id === cardId);

    if (!card || !card.inTray) return;

    // Calculate drop position
    const rect = cardArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale to project coordinates
    const scaleX = PROJECT_INFO.width / rect.width;
    const scaleY = PROJECT_INFO.height / rect.height;

    placeCardOnTable(card, x * scaleX, y * scaleY);
}

function placeCardInZone(card, zoneName, rotation, zoneElement) {
    // Mark as not in tray
    card.inTray = false;
    card.zone = zoneName;
    card.rotation = rotation;

    // Get existing cards in zone
    const zoneCards = appState.tableCards.filter(c => c.zone === zoneName);
    const position = zoneCards.length;

    // Calculate overlap position
    card.zonePosition = position;

    // Add to table cards
    appState.tableCards.push(card);

    // Create visual card in zone
    createZoneCardElement(card, zoneElement);

    // Update tray
    renderCardTray();
    hideInstructions();
    updateUI();

    setStatus(`Placed ${card.displayName || card.name} in ${zoneName} zone`);
}

function placeCardOnTable(card, x, y) {
    card.inTray = false;
    card.zone = 'table';
    card.x = x;
    card.y = y;
    card.rotation = 0;

    appState.tableCards.push(card);

    createTableCardElement(card);

    renderCardTray();
    hideInstructions();
    updateUI();

    setStatus(`Placed ${card.displayName || card.name} on table`);
}

// ============================================
// CARD ELEMENTS ON TABLE
// ============================================

function createZoneCardElement(card, zoneElement) {
    const zoneCardsContainer = zoneElement.querySelector('.zone-cards');
    const zoneName = zoneElement.dataset.zone;

    const cardEl = document.createElement('div');
    cardEl.className = `zone-card ${card.isFaceUp ? 'face-up' : 'face-down'}`;
    cardEl.id = card.id;
    cardEl.dataset.cardId = card.id;

    // Different overlap direction based on zone
    if (zoneName === 'left' || zoneName === 'right') {
        // Side zones: stack vertically, use marginTop for overlap
        cardEl.style.marginTop = card.zonePosition > 0 ? `-${CARD_HEIGHT - appState.cardOverlap}px` : '0';
    } else {
        // Top/Bottom/Community: stack horizontally, use marginLeft
        cardEl.style.marginLeft = card.zonePosition > 0 ? `-${CARD_WIDTH - appState.cardOverlap}px` : '0';
    }

    // Inner structure for flip
    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // Front face
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    const frontImg = document.createElement('img');
    frontImg.src = card.frontImageUrl || createPlaceholderCardImage(card);
    front.appendChild(frontImg);

    // Back face
    const back = document.createElement('div');
    back.className = 'card-face card-back';
    if (card.backImageUrl) {
        const backImg = document.createElement('img');
        backImg.src = card.backImageUrl;
        back.appendChild(backImg);
    }

    inner.appendChild(front);
    inner.appendChild(back);
    cardEl.appendChild(inner);

    // Click to flip
    cardEl.addEventListener('click', () => handleCardClick(card, cardEl));

    zoneCardsContainer.appendChild(cardEl);
    card.element = cardEl;
}

function createTableCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.isFaceUp ? 'face-up' : 'face-down'}`;
    cardEl.id = card.id;
    cardEl.dataset.cardId = card.id;

    // Position
    const scaleX = gameContainer.offsetWidth / PROJECT_INFO.width;
    const scaleY = gameContainer.offsetHeight / PROJECT_INFO.height;

    cardEl.style.left = '0';
    cardEl.style.top = '0';
    cardEl.style.transform = `translate(${card.x * scaleX}px, ${card.y * scaleY}px) rotate(${card.rotation}deg)`;

    // Inner structure for flip
    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // Front face
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    const frontImg = document.createElement('img');
    frontImg.src = card.frontImageUrl || createPlaceholderCardImage(card);
    front.appendChild(frontImg);

    // Back face
    const back = document.createElement('div');
    back.className = 'card-face card-back';
    if (card.backImageUrl) {
        const backImg = document.createElement('img');
        backImg.src = card.backImageUrl;
        back.appendChild(backImg);
    }

    inner.appendChild(front);
    inner.appendChild(back);
    cardEl.appendChild(inner);

    // Label
    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = card.displayName || card.name;
    cardEl.appendChild(label);

    // Click to select/flip
    cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCardClick(card, cardEl);
    });

    // Make draggable
    makeCardDraggable(cardEl, card);

    cardArea.appendChild(cardEl);
    card.element = cardEl;
}

// ============================================
// CARD INTERACTIONS
// ============================================

function handleCardClick(card, element) {
    // Select the card
    selectCard(card);

    // If in setup phase, also flip the card
    if (appState.phase === 'setup') {
        flipCard(card);
    }
}

function selectCard(card) {
    // Deselect previous
    if (appState.selectedCard && appState.selectedCard.element) {
        appState.selectedCard.element.classList.remove('selected');
    }

    appState.selectedCard = card;

    if (card.element) {
        card.element.classList.add('selected');
    }

    // Update properties panel
    noCardSelected.classList.add('hidden');
    cardProperties.classList.remove('hidden');
    selectedCardName.textContent = card.displayName || card.name;
    cardFaceState.textContent = card.isFaceUp ? 'Up' : 'Down';

    flipCardCheck.checked = card.flipAction || false;
    slamEffectCheck.checked = card.slamEffect || false;

    updateCardPosDisplay(card);
}

function deselectCard() {
    if (appState.selectedCard && appState.selectedCard.element) {
        appState.selectedCard.element.classList.remove('selected');
    }
    appState.selectedCard = null;

    noCardSelected.classList.remove('hidden');
    cardProperties.classList.add('hidden');
}

function flipCard(card) {
    card.isFaceUp = !card.isFaceUp;

    if (card.element) {
        // Add flip animation
        card.element.classList.add('flipping');

        setTimeout(() => {
            card.element.classList.remove('face-up', 'face-down');
            card.element.classList.add(card.isFaceUp ? 'face-up' : 'face-down');
            card.element.classList.remove('flipping');
        }, 200); // Half of flip duration
    }

    // Update panel
    if (appState.selectedCard === card) {
        cardFaceState.textContent = card.isFaceUp ? 'Up' : 'Down';
    }
}

function handleFlipAll() {
    const faceUpCount = appState.tableCards.filter(c => c.isFaceUp).length;
    const flipToUp = faceUpCount < appState.tableCards.length / 2;

    appState.tableCards.forEach(card => {
        if (card.isFaceUp !== flipToUp) {
            flipCard(card);
        }
    });

    setStatus(`Flipped all cards ${flipToUp ? 'face up' : 'face down'}`);
}

function updateCardPosDisplay(card) {
    cardPosX.textContent = Math.round(card.x || 0);
    cardPosY.textContent = Math.round(card.y || 0);
    cardRot.textContent = `${Math.round(card.rotation || 0)}°`;
}

// ============================================
// DRAGGABLE CARDS ON TABLE
// ============================================

function makeCardDraggable(element, card) {
    let isDragging = false;
    let offsetX, offsetY;

    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        isDragging = true;
        element.classList.add('dragging');

        const rect = cardArea.getBoundingClientRect();
        const scaleX = PROJECT_INFO.width / rect.width;
        const scaleY = PROJECT_INFO.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        offsetX = card.x - mouseX;
        offsetY = card.y - mouseY;

        element.style.zIndex = 1000;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = cardArea.getBoundingClientRect();
        const scaleX = PROJECT_INFO.width / rect.width;
        const scaleY = PROJECT_INFO.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        card.x = mouseX + offsetX;
        card.y = mouseY + offsetY;

        // Update visual position
        const visualX = card.x / scaleX;
        const visualY = card.y / scaleY;
        element.style.transform = `translate(${visualX}px, ${visualY}px) rotate(${card.rotation}deg)`;

        updateCardPosDisplay(card);
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        element.style.zIndex = '';
    });
}

// ============================================
// OVERLAP CONTROL
// ============================================

function handleOverlapChange() {
    appState.cardOverlap = parseInt(overlapSlider.value);
    overlapValue.textContent = `${appState.cardOverlap}px`;

    // Re-render zone cards with new overlap
    reRenderZoneCards();
}

function reRenderZoneCards() {
    playerZones.forEach(zone => {
        const zoneName = zone.dataset.zone;
        const zoneCards = appState.tableCards.filter(c => c.zone === zoneName);

        zoneCards.forEach((card, index) => {
            if (card.element) {
                card.element.style.marginLeft = index > 0 ? `-${CARD_WIDTH - appState.cardOverlap}px` : '0';
            }
        });
    });
}

// ============================================
// RESET TABLE
// ============================================

function handleResetTable() {
    if (appState.tableCards.length === 0) return;

    if (!confirm('Return all cards to tray?')) return;

    // Remove card elements
    appState.tableCards.forEach(card => {
        if (card.element) {
            card.element.remove();
        }
        card.inTray = true;
        card.zone = null;
        card.element = null;
        card.isFaceUp = false;
    });

    appState.tableCards = [];
    appState.selectedCard = null;

    renderCardTray();
    showInstructions();
    deselectCard();
    updateUI();

    setStatus('All cards returned to tray');
}

// ============================================
// RECORDING LOGIC
// ============================================

function handleAddStep() {
    if (appState.isEditingStep) {
        setStatus('Finish current step first', 'error');
        return;
    }

    if (appState.tableCards.length === 0) {
        setStatus('Place some cards on the table first', 'error');
        return;
    }

    startSnapshot = takeSnapshot();

    currentStep = {
        stepId: scenarioData.scenario.length + 1,
        duration: parseFloat(stepDuration.value) || 1.0,
        actions: []
    };

    appState.isEditingStep = true;
    appState.currentStepIndex = currentStep.stepId;

    finishStepBtn.disabled = false;
    addStepBtn.disabled = true;
    recordingIndicator.classList.add('active');
    currentStepNum.textContent = currentStep.stepId;

    setStatus(`Editing Step ${currentStep.stepId} - Move cards and set properties`);
}

function handleFinishStep() {
    if (!appState.isEditingStep || !currentStep) return;

    const endSnapshot = takeSnapshot();
    const actions = computeActions(startSnapshot, endSnapshot);

    currentStep.actions = actions;
    currentStep.duration = parseFloat(stepDuration.value) || 1.0;

    scenarioData.scenario.push(currentStep);

    appState.isEditingStep = false;
    currentStep = null;
    startSnapshot = null;

    finishStepBtn.disabled = true;
    addStepBtn.disabled = false;
    recordingIndicator.classList.remove('active');
    currentStepNum.textContent = '-';
    totalSteps.textContent = scenarioData.scenario.length;

    renderTimeline();
    setStatus(`Step ${scenarioData.scenario.length} saved with ${actions.length} actions`, 'success');
    updateUI();
}

function takeSnapshot() {
    const snapshot = {};
    appState.tableCards.forEach(card => {
        snapshot[card.id] = {
            x: card.x || 0,
            y: card.y || 0,
            rotation: card.rotation || 0,
            isFaceUp: card.isFaceUp
        };
    });
    return snapshot;
}

function computeActions(startSnap, endSnap) {
    const actions = [];

    appState.tableCards.forEach(card => {
        const start = startSnap[card.id];
        const end = endSnap[card.id];

        if (!start || !end) return;

        const posChanged = Math.abs((end.x || 0) - (start.x || 0)) > 1 ||
            Math.abs((end.y || 0) - (start.y || 0)) > 1;
        const rotChanged = Math.abs((end.rotation || 0) - (start.rotation || 0)) > 0.5;
        const flipChanged = end.isFaceUp !== start.isFaceUp;
        const hasFlipAction = card.flipAction;
        const hasSlam = card.slamEffect;

        if (posChanged || rotChanged || flipChanged || hasFlipAction || hasSlam) {
            actions.push({
                targetId: card.id,
                type: 'TRANSFORM',
                startPosition: { x: Math.round(start.x || 0), y: Math.round(start.y || 0) },
                endPosition: { x: Math.round(end.x || 0), y: Math.round(end.y || 0) },
                startRotation: Math.round(start.rotation || 0),
                endRotation: Math.round(end.rotation || 0),
                flip: hasFlipAction || flipChanged,
                flipToFaceUp: end.isFaceUp,
                effect: hasSlam ? 'SLAM' : null
            });
        }
    });

    return actions;
}

function handlePropertyChange() {
    if (!appState.selectedCard) return;

    appState.selectedCard.flipAction = flipCardCheck.checked;
    appState.selectedCard.slamEffect = slamEffectCheck.checked;
}

// ============================================
// INITIAL STATE & EXPORT
// ============================================

function saveInitialState() {
    scenarioData.initialState = {};

    appState.tableCards.forEach(card => {
        scenarioData.initialState[card.id] = {
            name: card.name,
            filename: card.filename,
            frontImage: card.filename,
            backImage: 'back.png',
            x: Math.round(card.x || 0),
            y: Math.round(card.y || 0),
            rotation: card.rotation || 0,
            zone: card.zone,
            isFaceUp: card.isFaceUp
        };
    });
}

function handleExportJSON() {
    if (appState.tableCards.length === 0) {
        setStatus('No cards on table to export', 'error');
        return;
    }

    saveInitialState();

    const jsonString = JSON.stringify(scenarioData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `poker_scenario_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus('Scenario exported!', 'success');
}

function handleExportToAE() {
    if (!csInterface) {
        setStatus('After Effects not connected', 'error');
        return;
    }

    if (appState.tableCards.length === 0) {
        setStatus('No cards on table', 'error');
        return;
    }

    if (!appState.assetsRootPath) {
        setStatus('Select Assets Folder first!', 'error');
        return;
    }

    saveInitialState();

    setStatus('Sending to After Effects...', 'recording');

    const jsonString = JSON.stringify(scenarioData);
    const assetsPath = escapeForScript(appState.assetsRootPath);

    csInterface.evalScript(
        `generateSequence('${escapeForScript(jsonString)}', '${assetsPath}')`,
        (result) => {
            try {
                const response = JSON.parse(result);
                if (response.success) {
                    setStatus(`✓ ${response.message}`, 'success');
                } else {
                    setStatus(`Error: ${response.message}`, 'error');
                }
            } catch (e) {
                setStatus('Sent to After Effects', 'success');
            }
        }
    );
}

function escapeForScript(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// ============================================
// ASSETS FOLDER
// ============================================

function handleSelectAssetsFolder() {
    if (typeof window.cep !== 'undefined' && window.cep.fs) {
        try {
            const result = window.cep.fs.showOpenDialogEx(
                false, true, 'Select Assets Folder', '', []
            );

            if (result.err === 0 && result.data && result.data.length > 0) {
                appState.assetsRootPath = result.data[0].replace(/\\/g, '/') + '/';
                updateAssetsDisplay();
                setStatus('Assets folder set', 'success');
            }
        } catch (e) {
            setStatus('Error selecting folder', 'error');
        }
    } else {
        const path = prompt('Enter assets folder path:', appState.deckPath || 'D:/Assets');
        if (path) {
            appState.assetsRootPath = path.replace(/\\/g, '/') + '/';
            updateAssetsDisplay();
        }
    }
}

function updateAssetsDisplay() {
    if (appState.assetsRootPath) {
        const shortPath = appState.assetsRootPath.split('/').slice(-3).join('/');
        assetsPathDisplay.innerHTML = `<span class="path-label">✓ .../${shortPath}</span>`;
        assetsPathDisplay.classList.add('has-path');
    }
}

// ============================================
// TIMELINE
// ============================================

function renderTimeline() {
    timelinePreview.innerHTML = '';

    scenarioData.scenario.forEach(step => {
        const el = document.createElement('div');
        el.className = 'timeline-step';
        if (step.actions.length > 0) el.classList.add('has-actions');
        el.textContent = step.stepId;
        el.title = `Step ${step.stepId}: ${step.actions.length} actions, ${step.duration}s`;
        timelinePreview.appendChild(el);
    });
}

// ============================================
// UI HELPERS
// ============================================

function updateUI() {
    tableCardCount.textContent = `Table: ${appState.tableCards.length}`;
    stepCount.textContent = `Steps: ${scenarioData.scenario.length}`;
    totalSteps.textContent = scenarioData.scenario.length;
}

function setStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-bar';
    if (type) statusMessage.classList.add(`status-${type}`);
}

function hideInstructions() {
    tableInstructions.classList.add('hidden');
}

function showInstructions() {
    tableInstructions.classList.remove('hidden');
}
