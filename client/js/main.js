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

// Replay Elements
let replayBtn, replayControls, replayProgress, stopReplayBtn;

// Modal Elements
let warningModal, warningMessage, confirmWarningBtn, cancelWarningBtn;

// Auto-Step Popup Elements
let autoStepPopup, autoStepYes, autoStepNo;

// Context Menu Elements
let cardContextMenu, ctxFlipBtn, ctxSlamBtn;

// Status
let statusMessage;

// Step snapshots for replay and restore
let stepSnapshots = [];

// Pending change for auto-step (stores snapshot before change)
let pendingChangeSnapshot = null;
let pendingChangeCard = null;

// Debug logging system
let debugLogs = [];
let debugOverlay, debugContent, toggleDebugBtn, copyDebugBtn, clearDebugBtn, closeDebugBtn;

// Custom debug log function
function debugLog(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    const timestamp = new Date().toLocaleTimeString();
    debugLogs.push(`[${timestamp}] ${msg}`);
    if (debugContent) {
        debugContent.textContent = debugLogs.join('\n');
        debugContent.scrollTop = debugContent.scrollHeight;
    }
    console.log(...args);
}

function debugWarn(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    const timestamp = new Date().toLocaleTimeString();
    debugLogs.push(`[${timestamp}] ⚠️ ${msg}`);
    if (debugContent) {
        debugContent.textContent = debugLogs.join('\n');
        debugContent.scrollTop = debugContent.scrollHeight;
    }
    console.warn(...args);
}

// Fallback copy function for CEP environment
function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            setStatus('Debug log copied to clipboard!', 'success');
        } else {
            setStatus('Copy failed - please select text manually', 'error');
        }
    } catch (err) {
        setStatus('Copy failed - please select text manually', 'error');
    }
    document.body.removeChild(textarea);
}



// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

function init() {
    getDOMElements();
    bindEvents();

    // Scan and populate deck dropdown, then auto-load first deck
    scanAndPopulateDecks();

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

    // Replay Elements
    replayBtn = document.getElementById('replayBtn');
    replayControls = document.getElementById('replayControls');
    replayProgress = document.getElementById('replayProgress');
    stopReplayBtn = document.getElementById('stopReplayBtn');

    // Modal Elements
    warningModal = document.getElementById('warningModal');
    warningMessage = document.getElementById('warningMessage');
    confirmWarningBtn = document.getElementById('confirmWarningBtn');
    cancelWarningBtn = document.getElementById('cancelWarningBtn');

    // Auto-Step Popup Elements
    autoStepPopup = document.getElementById('autoStepPopup');
    autoStepYes = document.getElementById('autoStepYes');
    autoStepNo = document.getElementById('autoStepNo');

    // Context Menu Elements
    cardContextMenu = document.getElementById('cardContextMenu');
    ctxFlipBtn = document.getElementById('ctxFlipBtn');
    ctxSlamBtn = document.getElementById('ctxSlamBtn');

    // Status
    statusMessage = document.getElementById('statusMessage');

    // Debug Overlay Elements
    debugOverlay = document.getElementById('debugOverlay');
    debugContent = document.getElementById('debugContent');
    toggleDebugBtn = document.getElementById('toggleDebugBtn');
    copyDebugBtn = document.getElementById('copyDebugBtn');
    clearDebugBtn = document.getElementById('clearDebugBtn');
    closeDebugBtn = document.getElementById('closeDebugBtn');
}


function bindEvents() {
    // Deck loading
    loadDeckBtn.addEventListener('click', handleLoadDeck);
    deckSelect.addEventListener('change', handleDeckSelectChange);

    // Search and filter
    cardSearch.addEventListener('input', filterTrayCards);
    suitFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => handleSuitFilter(btn));
    });

    // Phase switching
    setupPhaseBtn.addEventListener('click', () => setPhase('setup'));
    recordPhaseBtn.addEventListener('click', () => setPhase('record'));

    // Table controls
    resetTableBtn.addEventListener('click', handleResetTable);
    overlapSlider.addEventListener('input', handleOverlapChange);

    // Per-zone flip controls
    document.querySelectorAll('.zone-flip-controls input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleZoneFlipChange);
    });

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

    // Replay
    if (replayBtn) replayBtn.addEventListener('click', handleReplay);
    if (stopReplayBtn) stopReplayBtn.addEventListener('click', stopReplay);

    // Modal
    if (confirmWarningBtn) confirmWarningBtn.addEventListener('click', confirmWarning);
    if (cancelWarningBtn) cancelWarningBtn.addEventListener('click', hideWarningModal);

    // Auto-Step Popup
    if (autoStepYes) autoStepYes.addEventListener('click', handleAutoStepYes);
    if (autoStepNo) autoStepNo.addEventListener('click', handleAutoStepNo);

    // Context Menu
    if (ctxFlipBtn) ctxFlipBtn.addEventListener('click', toggleCtxFlip);
    if (ctxSlamBtn) ctxSlamBtn.addEventListener('click', toggleCtxSlam);

    // Zone drop targets
    setupZoneDropTargets();

    // Click on table to deselect
    cardArea.addEventListener('click', (e) => {
        if (e.target === cardArea) {
            deselectCard();
        }
    });

    // Debug Overlay
    if (toggleDebugBtn) toggleDebugBtn.addEventListener('click', () => {
        debugOverlay.classList.toggle('hidden');
    });
    if (copyDebugBtn) copyDebugBtn.addEventListener('click', () => {
        const textToCopy = debugLogs.join('\n');
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setStatus('Debug log copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback: use textarea method
                fallbackCopyText(textToCopy);
            });
        } else {
            // Fallback for CEP environment
            fallbackCopyText(textToCopy);
        }
    });

    if (clearDebugBtn) clearDebugBtn.addEventListener('click', () => {
        debugLogs = [];
        if (debugContent) debugContent.textContent = '';
    });
    if (closeDebugBtn) closeDebugBtn.addEventListener('click', () => {
        debugOverlay.classList.add('hidden');
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

/**
 * Scan the assets/decks folder and populate the deck dropdown
 */
function scanAndPopulateDecks() {
    // Browser mode - create placeholder cards
    if (!csInterface) {
        createPlaceholderDeck();
        return;
    }

    // CEP mode - get extension path
    const extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    const decksFolder = extPath + '/assets/decks';

    if (!fs || !fs.existsSync(decksFolder)) {
        setStatus('Decks folder not found. Use Load button to select a deck folder.');
        createPlaceholderDeck();
        return;
    }

    try {
        // Scan for subdirectories in decks folder
        const items = fs.readdirSync(decksFolder);
        const deckFolders = items.filter(item => {
            const itemPath = decksFolder + '/' + item;
            // Check if it's a directory and not a file like README.md
            return fs.statSync(itemPath).isDirectory();
        });

        if (deckFolders.length === 0) {
            setStatus('No deck folders found in assets/decks/');
            createPlaceholderDeck();
            return;
        }

        // Clear and populate dropdown
        deckSelect.innerHTML = '';
        deckFolders.forEach((folder, index) => {
            const option = document.createElement('option');
            option.value = decksFolder + '/' + folder;
            // Capitalize folder name for display
            option.textContent = folder.charAt(0).toUpperCase() + folder.slice(1);
            deckSelect.appendChild(option);
        });

        // Store decks folder path for later use
        appState.decksFolder = decksFolder;

        // Auto-load the first deck
        const firstDeckPath = decksFolder + '/' + deckFolders[0];
        loadDeckFromPath(firstDeckPath);

        console.log(`Found ${deckFolders.length} deck(s): ${deckFolders.join(', ')}`);

    } catch (e) {
        console.error('Error scanning decks folder:', e);
        setStatus('Error scanning decks: ' + e.message, 'error');
        createPlaceholderDeck();
    }
}

/**
 * Handle deck selection change from dropdown
 */
function handleDeckSelectChange() {
    const selectedPath = deckSelect.value;
    if (selectedPath) {
        // Reset table before loading new deck
        handleResetTable();
        loadDeckFromPath(selectedPath);
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

    // Note: Removed cardArea and pokerTable drop handlers
    // Cards can only be dropped into defined zones (player zones + community zone)
}

function handleZoneDrop(e, zone) {
    e.preventDefault();
    zone.classList.remove('drag-over');

    const cardId = e.dataTransfer.getData('text/plain');

    // Try to find card in tray first
    let card = appState.trayCards.find(c => c.id === cardId);
    const fromTray = card && card.inTray;

    // If not in tray, look for it in table cards (for moving between zones)
    if (!fromTray) {
        card = appState.tableCards.find(c => c.id === cardId);
        if (!card) return;
    }

    // Get zone info
    const zoneName = zone.dataset.zone;
    const rotation = parseInt(zone.dataset.rotation) || 0;

    if (fromTray) {
        // From tray - place new card in zone
        placeCardInZone(card, zoneName, rotation, zone);
    } else {
        // Moving card between zones (Record mode)
        moveCardToZone(card, zoneName, rotation, zone);
    }
}

/**
 * Move a card from one zone to another (used in Record mode)
 */
function moveCardToZone(card, newZoneName, newRotation, newZoneElement) {
    // Take snapshot BEFORE the move for auto-step feature
    const snapshotBeforeMove = (appState.phase === 'record' && !appState.isEditingStep) ? takeSnapshot() : null;

    // Remove card element from old zone
    if (card.element) {
        card.element.remove();
    }

    // Update card properties
    const oldZone = card.zone;
    card.zone = newZoneName;
    card.rotation = newRotation;

    // In Record mode with flipAction: start face-down, then animate flip
    if (appState.phase === 'record' && card.flipAction) {
        card.isFaceUp = false; // Start face-down for animation
    } else {
        // Setup mode or no flipAction: use zone checkbox
        const flipCheckbox = document.querySelector(`#flip${newZoneName.charAt(0).toUpperCase() + newZoneName.slice(1)}`);
        if (flipCheckbox) {
            card.isFaceUp = flipCheckbox.checked;
        }
    }

    // Recalculate zone positions for old zone (fill gaps)
    if (oldZone && oldZone !== newZoneName) {
        const oldZoneCards = appState.tableCards.filter(c => c.zone === oldZone && c.id !== card.id);
        oldZoneCards.forEach((c, idx) => {
            c.zonePosition = idx;
        });
        // Re-render old zone cards
        const oldZoneElement = document.querySelector(`.player-zone[data-zone="${oldZone}"], .community-zone[data-zone="${oldZone}"]`);
        if (oldZoneElement) {
            rerenderZoneCards(oldZone, oldZoneElement);
        }
    }

    // Get new position in target zone
    const newZoneCards = appState.tableCards.filter(c => c.zone === newZoneName && c.id !== card.id);
    card.zonePosition = newZoneCards.length;

    // Create visual card in new zone
    createZoneCardElement(card, newZoneElement);

    // Animate flip after element is created (Record mode with flipAction)
    if (appState.phase === 'record' && card.flipAction) {
        setTimeout(() => {
            flipCard(card);
        }, 150); // Small delay for visual effect
    }

    // Mark as having changes for recording
    if (appState.phase === 'record') {
        card.hasChanges = true;
    }

    updateUI();
    setStatus(`Moved ${card.displayName || card.name} to ${newZoneName} zone`);

    // Show auto-step popup in Record mode (if not manually editing a step)
    if (snapshotBeforeMove && appState.phase === 'record' && !appState.isEditingStep) {
        // Select the card so context menu appears next to it
        selectCard(card);
        showAutoStepPopup(card, snapshotBeforeMove);
    }
}

/**
 * Re-render all cards in a zone (used after moving cards)
 */
function rerenderZoneCards(zoneName, zoneElement) {
    const zoneCardsContainer = zoneElement.querySelector('.zone-cards');
    if (!zoneCardsContainer) return;

    // Clear zone cards container
    zoneCardsContainer.innerHTML = '';

    // Get all cards in this zone and re-create elements
    const zoneCards = appState.tableCards.filter(c => c.zone === zoneName);
    zoneCards.forEach(card => {
        createZoneCardElement(card, zoneElement);
    });
}


function placeCardInZone(card, zoneName, rotation, zoneElement) {
    // Take snapshot BEFORE placing card (for auto-step feature)
    const snapshotBeforePlace = (appState.phase === 'record' && !appState.isEditingStep) ? takeSnapshot() : null;

    // Mark as not in tray
    card.inTray = false;
    card.zone = zoneName;
    card.rotation = rotation;

    // Check if zone should show face-up (based on checkbox)
    const flipCheckbox = document.querySelector(`#flip${zoneName.charAt(0).toUpperCase() + zoneName.slice(1)}`);
    card.isFaceUp = flipCheckbox ? flipCheckbox.checked : false;

    // Get existing cards in zone
    const zoneCards = appState.tableCards.filter(c => c.zone === zoneName);
    const position = zoneCards.length;

    // Calculate overlap position
    card.zonePosition = position;

    // Add to table cards
    appState.tableCards.push(card);

    // Create visual card in zone
    createZoneCardElement(card, zoneElement);

    // Mark as having changes for recording
    if (appState.phase === 'record') {
        card.hasChanges = true;
    }

    // Update tray
    renderCardTray();
    hideInstructions();
    updateUI();

    setStatus(`Placed ${card.displayName || card.name} in ${zoneName} zone`);

    // Show auto-step popup in Record mode (if not manually editing a step)
    if (snapshotBeforePlace && appState.phase === 'record' && !appState.isEditingStep) {
        selectCard(card);
        showAutoStepPopup(card, snapshotBeforePlace);
    }
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

/**
 * Move an existing card to a new position on the table
 * Used in Record mode to reposition cards from zones to free table area
 */
function moveCardToPosition(card, x, y) {
    // Remove existing element
    if (card.element) {
        card.element.remove();
    }

    // Update card state
    const wasInZone = card.zone !== 'table';
    card.zone = 'table';
    card.x = x;
    card.y = y;
    card.rotation = 0;
    card.zonePosition = 0;

    // Create new table card element
    createTableCardElement(card);

    // Mark as having changes for recording
    if (appState.phase === 'record') {
        card.hasChanges = true;
    }

    updateUI();
    setStatus(`Moved ${card.displayName || card.name} to table`);
}

// ============================================
// CARD ELEMENTS ON TABLE
// ============================================

function createZoneCardElement(card, zoneElement) {
    const zoneCardsContainer = zoneElement.querySelector('.zone-cards');

    // Safety check - if container not found, log and skip
    if (!zoneCardsContainer) {
        debugWarn(`Zone container not found! zone: ${zoneElement?.dataset?.zone}, id: ${zoneElement?.id}`);
        return;
    }

    const zoneName = zoneElement.dataset.zone;


    const cardEl = document.createElement('div');
    cardEl.className = `zone-card ${card.isFaceUp ? 'face-up' : 'face-down'}`;
    cardEl.id = card.id;
    cardEl.dataset.cardId = card.id;

    // Different overlap direction based on zone
    if (zoneName === 'left') {
        // Left zone: cards stack top-to-bottom, later cards on top
        cardEl.style.marginTop = card.zonePosition > 0 ? `-${CARD_HEIGHT - appState.cardOverlap}px` : '0';
    } else if (zoneName === 'right') {
        // Right zone: cards stack bottom-to-top (reverse), so upper cards overlay lower
        cardEl.style.marginTop = card.zonePosition > 0 ? `-${CARD_HEIGHT - appState.cardOverlap}px` : '0';
        // Use z-index to reverse stacking visually - higher position = lower z-index
        cardEl.style.zIndex = 100 - card.zonePosition;
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

    // Click to flip/select
    cardEl.addEventListener('click', () => handleCardClick(card, cardEl));

    // Make draggable for Record mode (move cards between zones)
    cardEl.draggable = true;
    cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        cardEl.classList.add('dragging');
        // Highlight all zones as potential drop targets
        playerZones.forEach(zone => zone.classList.add('drag-target'));
    });
    cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        // Remove highlight from all zones
        playerZones.forEach(zone => zone.classList.remove('drag-target', 'drag-over'));
    });

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

    // Update card thumbnail
    const thumbContainer = document.getElementById('selectedCardThumb');
    thumbContainer.innerHTML = '';
    if (card.frontImageUrl) {
        const img = document.createElement('img');
        img.src = card.frontImageUrl;
        img.alt = card.displayName || card.name;
        thumbContainer.appendChild(img);
    }

    flipCardCheck.checked = card.flipAction || false;
    slamEffectCheck.checked = card.slamEffect || false;

    updateCardPosDisplay(card);

    // Show inline context menu next to card (Record mode only)
    showCardContextMenu(card);
}

function deselectCard() {
    if (appState.selectedCard && appState.selectedCard.element) {
        appState.selectedCard.element.classList.remove('selected');
    }
    appState.selectedCard = null;

    noCardSelected.classList.remove('hidden');
    cardProperties.classList.add('hidden');

    // Hide context menu
    hideCardContextMenu();
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

function handleZoneFlipChange(e) {
    const zoneName = e.target.dataset.zone;
    const shouldFaceUp = e.target.checked;

    // Find all cards in this zone and flip them accordingly
    appState.tableCards
        .filter(card => card.zone === zoneName)
        .forEach(card => {
            if (card.isFaceUp !== shouldFaceUp) {
                flipCard(card);
            }
        });

    setStatus(`${zoneName.charAt(0).toUpperCase() + zoneName.slice(1)} zone: ${shouldFaceUp ? 'Face up' : 'Face down'}`);
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

    // Save snapshot for replay and edit restore
    stepSnapshots.push(JSON.parse(JSON.stringify(endSnapshot)));

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

/**
 * Save the initial state of all cards when entering Record mode
 * This is used for replay and restore functionality
 */
function saveInitialState() {
    scenarioData.initialState = {};

    appState.tableCards.forEach(card => {
        scenarioData.initialState[card.id] = {
            x: card.x || 0,
            y: card.y || 0,
            rotation: card.rotation || 0,
            isFaceUp: card.isFaceUp,
            zone: card.zone,
            zonePosition: card.zonePosition || 0,
            flipAction: card.flipAction || false,
            slamEffect: card.slamEffect || false
        };
    });

    // Reset step snapshots when entering record mode
    stepSnapshots = [];

    console.log('Initial state saved:', scenarioData.initialState);
}

function takeSnapshot() {
    const snapshot = {};
    appState.tableCards.forEach(card => {
        snapshot[card.id] = {
            x: card.x || 0,
            y: card.y || 0,
            rotation: card.rotation || 0,
            isFaceUp: card.isFaceUp,
            zone: card.zone,
            zonePosition: card.zonePosition || 0,
            flipAction: card.flipAction || false,
            slamEffect: card.slamEffect || false
        };
    });
    return snapshot;
}

function computeActions(startSnap, endSnap) {
    const actions = [];

    appState.tableCards.forEach(card => {
        const start = startSnap[card.id];
        const end = endSnap[card.id];

        // New card placed from tray (not in start snapshot)
        if (!start && end) {
            actions.push({
                targetId: card.id,
                type: 'PLACE',
                startPosition: { x: 0, y: 0 },
                endPosition: { x: Math.round(end.x || 0), y: Math.round(end.y || 0) },
                startRotation: 0,
                endRotation: Math.round(end.rotation || 0),
                zone: end.zone,
                flip: card.flipAction,
                flipToFaceUp: end.isFaceUp,
                effect: card.slamEffect ? 'SLAM' : null
            });
            return;
        }

        if (!start || !end) return;

        const posChanged = Math.abs((end.x || 0) - (start.x || 0)) > 1 ||
            Math.abs((end.y || 0) - (start.y || 0)) > 1;
        const rotChanged = Math.abs((end.rotation || 0) - (start.rotation || 0)) > 0.5;
        const flipChanged = end.isFaceUp !== start.isFaceUp;
        const zoneChanged = end.zone !== start.zone;
        const hasFlipAction = card.flipAction;
        const hasSlam = card.slamEffect;

        if (posChanged || rotChanged || flipChanged || zoneChanged || hasFlipAction || hasSlam) {
            actions.push({
                targetId: card.id,
                type: 'TRANSFORM',
                startPosition: { x: Math.round(start.x || 0), y: Math.round(start.y || 0) },
                endPosition: { x: Math.round(end.x || 0), y: Math.round(end.y || 0) },
                startRotation: Math.round(start.rotation || 0),
                endRotation: Math.round(end.rotation || 0),
                startZone: start.zone,
                endZone: end.zone,
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

function saveInitialStateForExport() {
    // This version calculates positions for AE export
    const exportState = {};

    // Calculate card scale for AE (web cards displayed at 60x84, target ~120px height in 1080p)
    // This gives assets a scale factor to render at appropriate size
    const targetCardHeight = 150; // Target card height in 1080p composition
    const aeCardScale = targetCardHeight / 1080; // ~0.139 - about 14% scale

    appState.tableCards.forEach(card => {
        // Calculate position based on zone if not directly on table
        let posX = card.x || 0;
        let posY = card.y || 0;

        // For zone cards, calculate approximate center position
        if (card.zone !== 'table' && (!card.x && !card.y)) {
            const zonePositions = {
                'top': { x: PROJECT_INFO.width / 2, y: 100 },
                'bottom': { x: PROJECT_INFO.width / 2, y: PROJECT_INFO.height - 100 },
                'left': { x: 150, y: PROJECT_INFO.height / 2 },
                'right': { x: PROJECT_INFO.width - 150, y: PROJECT_INFO.height / 2 },
                'community': { x: PROJECT_INFO.width / 2, y: PROJECT_INFO.height / 2 }
            };
            const zonePos = zonePositions[card.zone] || { x: PROJECT_INFO.width / 2, y: PROJECT_INFO.height / 2 };
            posX = zonePos.x + (card.zonePosition || 0) * 40; // Offset for multiple cards
            posY = zonePos.y;
        }

        exportState[card.id] = {
            name: card.name,
            filename: card.filename,
            frontImage: card.filename,
            backImage: 'back.png',
            x: Math.round(posX),
            y: Math.round(posY),
            rotation: card.rotation || 0,
            scale: aeCardScale,
            zone: card.zone,
            zonePosition: card.zonePosition || 0,
            isFaceUp: card.isFaceUp
        };
    });

    return exportState;
}

function handleExportJSON() {
    if (appState.tableCards.length === 0) {
        setStatus('No cards on table to export', 'error');
        return;
    }

    // Use export version with AE-calculated positions
    const exportData = {
        ...scenarioData,
        initialState: saveInitialStateForExport()
    };

    const jsonString = JSON.stringify(exportData, null, 2);
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

    // Use export version with AE-calculated positions
    const exportData = {
        ...scenarioData,
        initialState: saveInitialStateForExport()
    };

    setStatus('Sending to After Effects...', 'recording');

    const jsonString = JSON.stringify(exportData);
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

    scenarioData.scenario.forEach((step, index) => {
        const el = document.createElement('div');
        el.className = 'timeline-step';
        if (step.actions.length > 0) el.classList.add('has-actions');

        // Step number
        const stepNum = document.createElement('span');
        stepNum.textContent = step.stepId;
        el.appendChild(stepNum);

        // Action buttons container
        const actions = document.createElement('div');
        actions.className = 'step-actions';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'step-action-btn edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Edit step';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleEditStep(index);
        });
        actions.appendChild(editBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'step-action-btn delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete step';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteStep(index);
        });
        actions.appendChild(deleteBtn);

        el.appendChild(actions);
        el.title = `Step ${step.stepId}: ${step.actions.length} actions, ${step.duration}s`;
        timelinePreview.appendChild(el);
    });

    // Update replay button state
    if (replayBtn) {
        replayBtn.disabled = scenarioData.scenario.length === 0;
    }
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

// ============================================
// REPLAY FUNCTIONALITY
// ============================================

let replayTimer = null;
let isReplaying = false;
let currentReplayStep = 0;

function handleReplay() {
    if (scenarioData.scenario.length === 0) {
        setStatus('No steps to replay', 'error');
        return;
    }

    if (isReplaying) {
        stopReplay();
        return;
    }

    // Check if we have snapshots for replay
    if (stepSnapshots.length === 0) {
        setStatus('No snapshots recorded - please record some steps first', 'error');
        debugWarn('stepSnapshots is empty:', stepSnapshots);
        return;
    }

    debugLog('Starting replay with', scenarioData.scenario.length, 'steps');
    debugLog('stepSnapshots:', stepSnapshots);


    isReplaying = true;
    currentReplayStep = 0;

    // Update UI
    replayBtn.textContent = '⏸️ Pause';
    replayControls.classList.remove('hidden');
    replayProgress.textContent = `Initial / ${scenarioData.scenario.length} steps`;

    // Start replay from initial state
    restoreToInitialState();

    setStatus('Showing initial state...', 'recording');

    // Give user time to see initial state before stepping
    setTimeout(() => {
        if (isReplaying) {
            setStatus('Replaying steps...', 'recording');
            replayNextStep();
        }
    }, 1000);
}


function replayNextStep() {
    debugLog('=== replayNextStep ===');
    debugLog('isReplaying:', isReplaying);
    debugLog('currentReplayStep:', currentReplayStep);
    debugLog('scenario.length:', scenarioData.scenario.length);

    if (!isReplaying || currentReplayStep >= scenarioData.scenario.length) {
        debugLog('Stopping replay - condition met');
        stopReplay();
        return;
    }

    const step = scenarioData.scenario[currentReplayStep];
    debugLog('Playing step:', currentReplayStep + 1, 'duration:', step.duration);
    replayProgress.textContent = `Step ${currentReplayStep + 1}/${scenarioData.scenario.length}`;

    // Use stepSnapshots to restore state (more reliable for zone cards)
    if (stepSnapshots[currentReplayStep]) {
        debugLog('Restoring from stepSnapshot', currentReplayStep);
        restoreFromSnapshot(stepSnapshots[currentReplayStep]);
    } else {
        debugWarn('No stepSnapshot at index', currentReplayStep);
    }

    currentReplayStep++;

    // Schedule next step
    const duration = (step.duration || 1) * 1000;
    debugLog('Scheduling next step in', duration, 'ms');
    replayTimer = setTimeout(() => {
        replayNextStep();
    }, duration);

}

function stopReplay() {
    isReplaying = false;

    if (replayTimer) {
        clearTimeout(replayTimer);
        replayTimer = null;
    }

    // Reset UI
    replayBtn.textContent = '▶️ Replay Steps';
    replayControls.classList.add('hidden');

    setStatus(`Replay finished at step ${currentReplayStep}/${scenarioData.scenario.length}`, 'success');
}

function restoreToInitialState() {
    debugLog('=== restoreToInitialState ===');
    debugLog('initialState:', scenarioData.initialState);
    debugLog('tableCards:', appState.tableCards);

    // First, remove all card elements from zones
    playerZones.forEach(zone => {
        const container = zone.querySelector('.zone-cards');
        if (container) container.innerHTML = '';
    });
    cardArea.innerHTML = '';

    // Apply initial state to all cards
    Object.entries(scenarioData.initialState).forEach(([cardId, state]) => {
        const card = appState.tableCards.find(c => c.id === cardId);
        if (!card) {
            debugWarn('Card not found in tableCards:', cardId);
            return;
        }

        debugLog(`Restoring card ${cardId} to zone: ${state.zone}`);
        card.x = state.x;
        card.y = state.y;
        card.rotation = state.rotation;
        card.isFaceUp = state.isFaceUp;
        card.zone = state.zone;
        card.zonePosition = state.zonePosition || 0;
        card.element = null;
    });

    // Re-create elements for all cards in their zones
    // Sort by zone and zonePosition to ensure correct order
    const sortedCards = [...appState.tableCards].sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.zonePosition || 0) - (b.zonePosition || 0);
    });

    debugLog('sortedCards for rendering:', sortedCards.map(c => ({ id: c.id, zone: c.zone })));

    sortedCards.forEach(card => {
        try {
            if (card.zone && card.zone !== 'table') {
                // Use specific selectors to target zone divs, not checkboxes
                const zoneElement = document.querySelector(`.player-zone[data-zone="${card.zone}"], .community-zone[data-zone="${card.zone}"]`);
                debugLog(`Creating zone card ${card.id} in zone ${card.zone}, element found:`, !!zoneElement);
                if (zoneElement) {
                    createZoneCardElement(card, zoneElement);
                }
            } else if (card.zone === 'table') {
                debugLog(`Creating table card ${card.id}`);
                createTableCardElement(card);
            } else {
                debugWarn(`Card ${card.id} has no valid zone:`, card.zone);
            }
        } catch (err) {
            debugWarn(`ERROR creating card ${card.id}:`, err.message);
            console.error('Full error:', err);
        }
    });

    debugLog('=== restoreToInitialState COMPLETE ===');
    updateUI();
}



// ============================================
// EDIT/DELETE STEPS
// ============================================

let pendingWarningCallback = null;

function handleDeleteStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= scenarioData.scenario.length) return;

    const isLastStep = stepIndex === scenarioData.scenario.length - 1;

    if (!isLastStep) {
        // Deleting middle step - warn about subsequent steps
        showWarningModal(
            `Deleting step ${stepIndex + 1} will also delete all ${scenarioData.scenario.length - stepIndex - 1} subsequent steps. Continue?`,
            () => {
                // Delete this step and all after it
                scenarioData.scenario = scenarioData.scenario.slice(0, stepIndex);
                stepSnapshots = stepSnapshots.slice(0, stepIndex);
                renumberSteps();
                renderTimeline();
                updateUI();
                setStatus(`Deleted step ${stepIndex + 1} and subsequent steps`, 'success');
            }
        );
    } else {
        // Deleting last step - just remove it
        scenarioData.scenario.pop();
        stepSnapshots.pop();
        renderTimeline();
        updateUI();
        setStatus(`Deleted step ${stepIndex + 1}`, 'success');
    }
}

function handleEditStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= scenarioData.scenario.length) return;

    const isLastStep = stepIndex === scenarioData.scenario.length - 1;

    if (!isLastStep) {
        // Editing middle step - warn about subsequent steps
        showWarningModal(
            `Editing step ${stepIndex + 1} will delete all ${scenarioData.scenario.length - stepIndex - 1} subsequent steps. Continue?`,
            () => {
                // Delete steps after this one
                scenarioData.scenario = scenarioData.scenario.slice(0, stepIndex);
                stepSnapshots = stepSnapshots.slice(0, stepIndex);
                renumberSteps();

                // Restore to state before this step
                if (stepIndex === 0) {
                    restoreToInitialState();
                } else if (stepSnapshots[stepIndex - 1]) {
                    restoreFromSnapshot(stepSnapshots[stepIndex - 1]);
                }

                renderTimeline();
                updateUI();
                setStatus(`Ready to re-record step ${stepIndex + 1}. Click "Add Step" to start.`, 'success');
            }
        );
    } else {
        // Editing last step - just remove it and restore
        scenarioData.scenario.pop();

        if (stepSnapshots.length > 0) {
            const prevSnapshot = stepSnapshots[stepSnapshots.length - 1];
            stepSnapshots.pop();

            if (prevSnapshot) {
                restoreFromSnapshot(prevSnapshot);
            } else if (scenarioData.initialState) {
                restoreToInitialState();
            }
        } else {
            restoreToInitialState();
        }

        renderTimeline();
        updateUI();
        setStatus(`Ready to re-record last step. Click "Add Step" to start.`, 'success');
    }
}

function renumberSteps() {
    scenarioData.scenario.forEach((step, idx) => {
        step.stepId = idx + 1;
    });
}

function restoreFromSnapshot(snapshot) {
    debugLog('=== restoreFromSnapshot ===');
    debugLog('snapshot:', snapshot);

    // First, remove all card elements from zones
    playerZones.forEach(zone => {
        const container = zone.querySelector('.zone-cards');
        if (container) container.innerHTML = '';
    });
    cardArea.innerHTML = '';

    // Restore each card to its saved state
    Object.entries(snapshot).forEach(([cardId, state]) => {
        const card = appState.tableCards.find(c => c.id === cardId);
        if (!card) {
            debugWarn('Card not found in tableCards:', cardId);
            return;
        }

        debugLog(`Restoring card ${cardId} to zone: ${state.zone}`);
        // Restore all properties
        card.x = state.x || 0;
        card.y = state.y || 0;
        card.rotation = state.rotation || 0;
        card.isFaceUp = state.isFaceUp;
        card.zone = state.zone;
        card.zonePosition = state.zonePosition || 0;
        card.flipAction = state.flipAction || false;
        card.slamEffect = state.slamEffect || false;
        card.element = null;
    });

    // Re-create elements for all cards in their zones
    // Sort by zone and zonePosition to ensure correct order
    const sortedCards = [...appState.tableCards].sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.zonePosition || 0) - (b.zonePosition || 0);
    });

    debugLog('sortedCards for rendering:', sortedCards.map(c => ({ id: c.id, zone: c.zone })));

    sortedCards.forEach(card => {
        if (card.zone && card.zone !== 'table') {
            // Use specific selectors to target zone divs, not checkboxes
            const zoneElement = document.querySelector(`.player-zone[data-zone="${card.zone}"], .community-zone[data-zone="${card.zone}"]`);
            debugLog(`Creating zone card ${card.id} in zone ${card.zone}, element found:`, !!zoneElement);
            if (zoneElement) {
                createZoneCardElement(card, zoneElement);
            }
        } else if (card.zone === 'table') {
            debugLog(`Creating table card ${card.id}`);
            createTableCardElement(card);
        } else {
            debugWarn(`Card ${card.id} has no valid zone:`, card.zone);
        }
    });

    updateUI();
}


// ============================================
// WARNING MODAL
// ============================================

function showWarningModal(message, onConfirm) {
    if (!warningModal) return;

    warningMessage.textContent = message;
    pendingWarningCallback = onConfirm;
    warningModal.classList.remove('hidden');
}

function hideWarningModal() {
    if (!warningModal) return;

    warningModal.classList.add('hidden');
    pendingWarningCallback = null;
}

function confirmWarning() {
    if (pendingWarningCallback) {
        pendingWarningCallback();
    }
    hideWarningModal();
}

// ============================================
// AUTO-STEP POPUP
// ============================================

/**
 * Show auto-step popup when card is moved in Record mode
 */
function showAutoStepPopup(card, previousSnapshot) {
    if (!autoStepPopup) return;

    pendingChangeSnapshot = previousSnapshot;
    pendingChangeCard = card;

    autoStepPopup.classList.remove('hidden');
}

/**
 * Hide auto-step popup
 */
function hideAutoStepPopup() {
    if (!autoStepPopup) return;

    autoStepPopup.classList.add('hidden');
    pendingChangeSnapshot = null;
    pendingChangeCard = null;
}

/**
 * Handle Yes button - create new step automatically
 */
function handleAutoStepYes() {
    debugLog('=== handleAutoStepYes ===');
    debugLog('pendingChangeSnapshot:', !!pendingChangeSnapshot);

    if (!pendingChangeSnapshot) {
        debugWarn('No pendingChangeSnapshot, aborting');
        hideAutoStepPopup();
        return;
    }

    // Create step automatically
    const endSnapshot = takeSnapshot();
    const actions = computeActions(pendingChangeSnapshot, endSnapshot);

    debugLog('pendingChangeSnapshot keys:', Object.keys(pendingChangeSnapshot || {}));
    debugLog('endSnapshot keys:', Object.keys(endSnapshot || {}));
    debugLog('actions computed:', actions.length, actions);

    if (actions.length > 0) {
        const newStep = {
            stepId: scenarioData.scenario.length + 1,
            duration: parseFloat(stepDuration.value) || 1.0,
            actions: actions
        };

        scenarioData.scenario.push(newStep);

        // Save snapshot for replay and edit restore
        stepSnapshots.push(JSON.parse(JSON.stringify(endSnapshot)));

        totalSteps.textContent = scenarioData.scenario.length;
        renderTimeline();
        updateUI();
        debugLog('Step created:', newStep.stepId, 'Total steps:', scenarioData.scenario.length);
        setStatus(`Step ${scenarioData.scenario.length} auto-created with ${actions.length} actions`, 'success');
    } else {
        debugWarn('No actions detected between snapshots');
        setStatus('No changes detected', 'info');
    }

    hideAutoStepPopup();
}


/**
 * Handle No button - revert card to previous position
 */
function handleAutoStepNo() {
    if (!pendingChangeSnapshot) {
        hideAutoStepPopup();
        return;
    }

    // Revert all cards to previous snapshot
    restoreFromSnapshot(pendingChangeSnapshot);

    setStatus('Changes reverted', 'info');
    hideAutoStepPopup();
}

/**
 * Trigger auto-step popup when card movement is detected in Record mode
 * Called from moveCardToZone
 */
function triggerAutoStepCheck() {
    if (appState.phase !== 'record') return;
    if (appState.isEditingStep) return; // Don't trigger if manually editing a step

    // Take snapshot before showing popup (this becomes the "before" state)
    // Note: The snapshot was taken BEFORE the move in moveCardToZone
}

// ============================================
// INLINE CARD CONTEXT MENU
// ============================================

/**
 * Show context menu next to selected card (Record mode only)
 */
function showCardContextMenu(card) {
    if (!cardContextMenu || !card.element) return;

    // Only show in Record mode
    if (appState.phase !== 'record') {
        hideCardContextMenu();
        return;
    }

    // Position menu next to card
    const cardRect = card.element.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    // Position to the right of the card
    let left = cardRect.right - containerRect.left + 5;
    let top = cardRect.top - containerRect.top;

    // Keep within bounds
    if (left + 150 > containerRect.width) {
        left = cardRect.left - containerRect.left - 155;
    }

    cardContextMenu.style.left = `${left}px`;
    cardContextMenu.style.top = `${top}px`;

    // Update button states
    updateContextMenuState(card);

    cardContextMenu.classList.remove('hidden');
}

/**
 * Hide context menu
 */
function hideCardContextMenu() {
    if (!cardContextMenu) return;
    cardContextMenu.classList.add('hidden');
}

/**
 * Update context menu button active states
 */
function updateContextMenuState(card) {
    if (!card) return;

    if (ctxFlipBtn) {
        ctxFlipBtn.classList.toggle('active', card.flipAction || false);
    }
    if (ctxSlamBtn) {
        ctxSlamBtn.classList.toggle('active', card.slamEffect || false);
    }
}

/**
 * Toggle flip action on selected card
 */
function toggleCtxFlip() {
    if (!appState.selectedCard) return;

    appState.selectedCard.flipAction = !appState.selectedCard.flipAction;

    // Sync with properties panel
    flipCardCheck.checked = appState.selectedCard.flipAction;

    // Update button state
    if (ctxFlipBtn) {
        ctxFlipBtn.classList.toggle('active', appState.selectedCard.flipAction);
    }

    setStatus(appState.selectedCard.flipAction ? 'Flip animation enabled' : 'Flip animation disabled');

    // Auto-hide menu after selection (with brief delay to show state change)
    setTimeout(() => {
        hideCardContextMenu();
    }, 300);
}

/**
 * Toggle slam effect on selected card
 */
function toggleCtxSlam() {
    if (!appState.selectedCard) return;

    appState.selectedCard.slamEffect = !appState.selectedCard.slamEffect;

    // Sync with properties panel
    slamEffectCheck.checked = appState.selectedCard.slamEffect;

    // Update button state
    if (ctxSlamBtn) {
        ctxSlamBtn.classList.toggle('active', appState.selectedCard.slamEffect);
    }

    setStatus(appState.selectedCard.slamEffect ? 'Slam effect enabled' : 'Slam effect disabled');

    // Auto-hide menu after selection (with brief delay to show state change)
    setTimeout(() => {
        hideCardContextMenu();
    }, 300);
}
