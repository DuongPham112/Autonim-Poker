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

// Coordinate System: UI (1280x720) → AE (1920x1080)
const UI_WIDTH = 1280;
const UI_HEIGHT = 720;
const AE_WIDTH = 1920;
const AE_HEIGHT = 1080;
const COORD_SCALE = AE_WIDTH / UI_WIDTH; // 1.5x scale factor

// Card dimensions (in UI pixels)
const CARD_WIDTH = 60;
const CARD_HEIGHT = 84;
const CARD_SPACING_UI = 68; // Spacing between cards in zones (slightly more than card width)


// Standard 52-card deck
const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

// Application State
const appState = {
    phase: 'setup',               // 'board-setting', 'setup' or 'record'
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
    cardOverlap: 25,              // Overlap in pixels
    stepBlending: 0,              // Step blending % for AE export (0-50)

    // Board Layout
    boardLayout: {
        type: 'poker',            // 'poker' or 'grid'
        name: 'Poker (4 Players)',
        gridCols: 4,
        gridRows: 3,
        cardPlaces: []            // For grid mode: [{id, x, y, label}, ...]
    },
    selectedCardPlace: null       // Currently selected card place marker
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
let boardSettingBtn, setupPhaseBtn, recordPhaseBtn, recordingIndicator, modeBadge;
let flipAllBtn, resetTableBtn, tableCardCount, stepCount;

// Board Setting Controls
let boardSettingSection, presetSelect, loadPresetBtn;
let gridCols, gridRows, applyGridBtn;
let addCardPlaceBtn, clearBoardBtn;
let presetName, savePresetBtn, cardPlacesList;

// Board Layout Info (for setup/record phases)
let boardLayoutInfo, currentLayoutName, editLayoutBtn;

// Flip Controls
let pokerFlipControls, gridFlipControls;
let flipAllFaceUp, flipAllFaceDown, gridDefaultFaceUp;
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

    // Initialize Timeline Modules (Phase 1)
    initTimelineModulesIntegration();

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
    boardSettingBtn = document.getElementById('boardSettingBtn');
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

    // Board Setting Controls
    boardSettingSection = document.getElementById('boardSettingSection');
    presetSelect = document.getElementById('presetSelect');
    loadPresetBtn = document.getElementById('loadPresetBtn');
    gridCols = document.getElementById('gridCols');
    gridRows = document.getElementById('gridRows');
    applyGridBtn = document.getElementById('applyGridBtn');
    addCardPlaceBtn = document.getElementById('addCardPlaceBtn');
    clearBoardBtn = document.getElementById('clearBoardBtn');
    presetName = document.getElementById('presetName');
    savePresetBtn = document.getElementById('savePresetBtn');
    cardPlacesList = document.getElementById('cardPlacesList');

    // Board Layout Info
    boardLayoutInfo = document.getElementById('boardLayoutInfo');
    currentLayoutName = document.getElementById('currentLayoutName');
    editLayoutBtn = document.getElementById('editLayoutBtn');

    // Flip Controls
    pokerFlipControls = document.getElementById('pokerFlipControls');
    gridFlipControls = document.getElementById('gridFlipControls');
    flipAllFaceUp = document.getElementById('flipAllFaceUp');
    flipAllFaceDown = document.getElementById('flipAllFaceDown');
    gridDefaultFaceUp = document.getElementById('gridDefaultFaceUp');

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
    boardSettingBtn.addEventListener('click', () => setPhase('board-setting'));
    setupPhaseBtn.addEventListener('click', () => setPhase('setup'));
    recordPhaseBtn.addEventListener('click', () => setPhase('record'));

    // Board Setting Controls
    if (loadPresetBtn) loadPresetBtn.addEventListener('click', handleLoadPreset);
    if (applyGridBtn) applyGridBtn.addEventListener('click', handleApplyGrid);
    if (addCardPlaceBtn) addCardPlaceBtn.addEventListener('click', handleAddCardPlace);
    if (clearBoardBtn) clearBoardBtn.addEventListener('click', handleClearBoard);
    if (savePresetBtn) savePresetBtn.addEventListener('click', handleSavePreset);

    // Edit Layout button (in setup/record mode)
    if (editLayoutBtn) editLayoutBtn.addEventListener('click', () => setPhase('board-setting'));

    // Table controls
    resetTableBtn.addEventListener('click', handleResetTable);
    overlapSlider.addEventListener('input', handleOverlapChange);

    // Per-zone flip controls (Poker layout)
    document.querySelectorAll('#pokerFlipControls input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleZoneFlipChange);
    });

    // Grid flip controls
    if (flipAllFaceUp) flipAllFaceUp.addEventListener('click', () => handleFlipAllCards(true));
    if (flipAllFaceDown) flipAllFaceDown.addEventListener('click', () => handleFlipAllCards(false));

    // Assets folder
    selectAssetsFolderBtn.addEventListener('click', handleSelectAssetsFolder);

    // Recording controls
    addStepBtn.addEventListener('click', handleAddStep);
    if (finishStepBtn) finishStepBtn.addEventListener('click', handleFinishStep);

    // Card properties
    flipCardCheck.addEventListener('change', handlePropertyChange);
    slamEffectCheck.addEventListener('change', handlePropertyChange);

    // Export
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', handleExportJSON);
    exportToAEBtn.addEventListener('click', handleExportToAE);

    // Replay
    if (replayBtn) replayBtn.addEventListener('click', handleReplay);
    if (stopReplayBtn) stopReplayBtn.addEventListener('click', stopReplay);

    // Speed slider
    const stepSpeedSlider = document.getElementById('stepSpeedSlider');
    const stepSpeedValue = document.getElementById('stepSpeedValue');
    if (stepSpeedSlider) {
        stepSpeedSlider.addEventListener('input', () => {
            replaySpeed = parseFloat(stepSpeedSlider.value);
            if (stepSpeedValue) stepSpeedValue.textContent = replaySpeed + 'x';
        });
    }

    // Blending slider
    const stepBlendingSlider = document.getElementById('stepBlendingSlider');
    const stepBlendingValue = document.getElementById('stepBlendingValue');
    if (stepBlendingSlider) {
        stepBlendingSlider.addEventListener('input', () => {
            appState.stepBlending = parseInt(stepBlendingSlider.value);
            if (stepBlendingValue) stepBlendingValue.textContent = appState.stepBlending + '%';
        });
    }

    // Project Save/Load
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    const loadProjectBtn = document.getElementById('loadProjectBtn');
    const loadProjectInput = document.getElementById('loadProjectInput');
    if (saveProjectBtn) saveProjectBtn.addEventListener('click', handleSaveProject);
    if (loadProjectBtn) loadProjectBtn.addEventListener('click', () => loadProjectInput.click());
    if (loadProjectInput) loadProjectInput.addEventListener('change', handleLoadProject);

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

    // Reset all phase button states
    boardSettingBtn.classList.remove('active');
    setupPhaseBtn.classList.remove('active');
    recordPhaseBtn.classList.remove('active');
    modeBadge.classList.remove('recording', 'board-setting');

    // Hide all phase-specific sections
    if (boardSettingSection) boardSettingSection.classList.remove('visible');
    if (boardLayoutInfo) boardLayoutInfo.classList.remove('visible');
    if (stepControlsSection) stepControlsSection.classList.add('hidden');
    gameContainer.classList.remove('board-setting-mode');
    clearCardDropZones(); // Clear drop zones when switching phases
    // Note: Don't remove grid-mode here - preserve it across phases

    if (phase === 'board-setting') {
        boardSettingBtn.classList.add('active');
        modeBadge.textContent = 'BOARD';
        modeBadge.classList.add('board-setting');
        if (boardSettingSection) boardSettingSection.classList.add('visible');
        gameContainer.classList.add('board-setting-mode');

        // Add grid-mode if layout type is grid
        if (appState.boardLayout.type === 'grid') {
            gameContainer.classList.add('grid-mode');
        } else {
            gameContainer.classList.remove('grid-mode');
        }

        // Render card place markers
        renderCardPlaceMarkers();
        setStatus('Board Setting - Customize card positions');
    } else if (phase === 'setup') {
        setupPhaseBtn.classList.add('active');
        modeBadge.textContent = 'SETUP';

        // Show board layout info (remove record-mode to show Edit button)
        if (boardLayoutInfo) {
            boardLayoutInfo.classList.add('visible');
            boardLayoutInfo.classList.remove('record-mode');
        }
        updateLayoutInfoDisplay();

        // Clear editable markers, render drop zones instead
        clearCardPlaceMarkers();

        // Render card drop zones for grid mode
        if (appState.boardLayout.type === 'grid') {
            gameContainer.classList.add('grid-mode');
            renderCardDropZones();
        }

        setStatus('Setup - Drag cards to the table');
    } else if (phase === 'record') {
        recordPhaseBtn.classList.add('active');
        modeBadge.textContent = 'RECORD';
        modeBadge.classList.add('recording');
        if (stepControlsSection) stepControlsSection.classList.remove('hidden');

        // Show board layout info (add record-mode to hide Edit button)
        if (boardLayoutInfo) {
            boardLayoutInfo.classList.add('visible');
            boardLayoutInfo.classList.add('record-mode');
        }
        updateLayoutInfoDisplay();

        // Clear card place markers
        clearCardPlaceMarkers();

        // Render card drop zones for grid mode (same as setup)
        if (appState.boardLayout.type === 'grid') {
            gameContainer.classList.add('grid-mode');
            renderCardDropZones();
        }

        // Save initial state when entering record phase
        saveInitialState();
        setStatus('Record - Create animation steps');
    }

    updateUI();
}

/**
 * Update the layout info display in setup/record modes
 */
function updateLayoutInfoDisplay() {
    if (currentLayoutName) {
        currentLayoutName.textContent = appState.boardLayout.name || 'Poker (4 Players)';
    }

    // Toggle flip controls visibility based on layout type
    updateFlipControlsVisibility();
}

/**
 * Update flip controls visibility based on board layout type
 */
function updateFlipControlsVisibility() {
    if (appState.boardLayout.type === 'grid') {
        // Show grid controls, hide poker controls
        if (pokerFlipControls) pokerFlipControls.classList.add('hidden');
        if (gridFlipControls) gridFlipControls.classList.remove('hidden');
    } else {
        // Show poker controls, hide grid controls
        if (pokerFlipControls) pokerFlipControls.classList.remove('hidden');
        if (gridFlipControls) gridFlipControls.classList.add('hidden');
    }
}

/**
 * Flip all table cards face up or face down
 */
function handleFlipAllCards(faceUp) {
    appState.tableCards.forEach(card => {
        card.isFaceUp = faceUp;
        // Update visual representation
        const cardEl = document.querySelector(`.card[data-card-id="${card.id}"]`);
        if (cardEl) {
            if (faceUp) {
                cardEl.classList.add('face-up');
            } else {
                cardEl.classList.remove('face-up');
            }
            // Update card image
            const img = cardEl.querySelector('img');
            if (img) {
                img.src = faceUp ? (card.frontImageUrl || '') : (card.backImageUrl || '');
            }
        }
    });

    setStatus(faceUp ? 'All cards flipped face up' : 'All cards flipped face down');
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

    // Highlight drop zones (both player zones and grid drop zones)
    playerZones.forEach(zone => zone.classList.add('drag-target'));
    document.querySelectorAll('.card-drop-zone').forEach(zone => zone.classList.add('drag-target'));
}

function handleTrayCardDragEnd(e) {
    e.target.classList.remove('dragging');
    playerZones.forEach(zone => zone.classList.remove('drag-target', 'drag-over'));
    document.querySelectorAll('.card-drop-zone').forEach(zone => zone.classList.remove('drag-target', 'drag-over'));
}

function setupZoneDropTargets() {
    // Setup player zones (for poker layout)
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

    // Setup grid drop zones (for grid layout) - handled dynamically in renderCardDropZones
    // Note: Grid zones are created dynamically when entering setup mode
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

    // Check if this is a grid zone with existing cards (for swap/stack logic)
    if (zoneName.startsWith('grid-') && appState.phase === 'record') {
        const existingCards = appState.tableCards.filter(c => c.zone === zoneName && c.id !== cardId);

        if (existingCards.length > 0 && !fromTray) {
            // Show swap/stack popup for grid zones with existing cards
            showSwapStackPopup(card, existingCards[0], zoneName, rotation, zone);
            return;
        }
    }

    if (fromTray) {
        // From tray - place new card in zone
        placeCardInZone(card, zoneName, rotation, zone);
    } else {
        // Moving card between zones (Record mode)
        moveCardToZone(card, zoneName, rotation, zone);
    }
}

/**
 * Show popup to choose between swap or stack when dropping card on occupied grid zone
 */
function showSwapStackPopup(movingCard, existingCard, zoneName, rotation, zoneElement) {
    // Remove any existing popup
    const oldPopup = document.querySelector('.swap-stack-popup');
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'swap-stack-popup';
    popup.innerHTML = `
        <div class="popup-title">Zone has a card</div>
        <div class="popup-buttons">
            <button class="btn btn-sm btn-swap" title="Swap positions with existing card">🔄 Swap</button>
            <button class="btn btn-sm btn-stack" title="Stack on top of existing card">📚 Stack</button>
            <button class="btn btn-sm btn-cancel">✕</button>
        </div>
    `;

    // Position near the zone
    const zoneRect = zoneElement.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();
    popup.style.left = `${zoneRect.left - containerRect.left + zoneRect.width / 2}px`;
    popup.style.top = `${zoneRect.top - containerRect.top - 50}px`;

    // Event handlers
    popup.querySelector('.btn-swap').addEventListener('click', () => {
        popup.remove();
        swapCards(movingCard, existingCard);
    });

    popup.querySelector('.btn-stack').addEventListener('click', () => {
        popup.remove();
        moveCardToZone(movingCard, zoneName, rotation, zoneElement);
    });

    popup.querySelector('.btn-cancel').addEventListener('click', () => {
        popup.remove();
    });

    gameContainer.appendChild(popup);
}

/**
 * Swap two cards between their zones (used in Record mode for grid)
 */
function swapCards(card1, card2) {
    // Take snapshot BEFORE the swap
    const snapshotBeforeSwap = (appState.phase === 'record' && !appState.isEditingStep) ? takeSnapshot() : null;

    // Store original positions
    const zone1 = card1.zone;
    const zone2 = card2.zone;
    const pos1 = card1.zonePosition;
    const pos2 = card2.zonePosition;

    // Remove card elements
    if (card1.element) card1.element.remove();
    if (card2.element) card2.element.remove();

    // Swap zone assignments
    card1.zone = zone2;
    card1.zonePosition = pos2;
    card2.zone = zone1;
    card2.zonePosition = pos1;

    // Re-create card elements in new zones
    const zone1Element = document.querySelector(`.card-drop-zone[data-zone="${zone1}"], .player-zone[data-zone="${zone1}"]`);
    const zone2Element = document.querySelector(`.card-drop-zone[data-zone="${zone2}"], .player-zone[data-zone="${zone2}"]`);

    if (zone1Element) createZoneCardElement(card2, zone1Element);
    if (zone2Element) createZoneCardElement(card1, zone2Element);

    // Mark as having changes for recording
    card1.hasChanges = true;
    card2.hasChanges = true;

    updateUI();
    setStatus(`Swapped ${card1.displayName || card1.name} with ${card2.displayName || card2.name}`);

    // Show auto-step popup if in Record mode
    if (snapshotBeforeSwap && appState.phase === 'record' && !appState.isEditingStep) {
        selectCard(card1);
        showAutoStepPopup(card1, snapshotBeforeSwap);
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

    // Determine face up/down state based on layout type
    if (zoneName.startsWith('grid-')) {
        // Grid layout: use gridDefaultFaceUp checkbox
        card.isFaceUp = gridDefaultFaceUp ? gridDefaultFaceUp.checked : false;
    } else {
        // Poker layout: use zone-specific checkbox
        const flipCheckbox = document.querySelector(`#flip${zoneName.charAt(0).toUpperCase() + zoneName.slice(1)}`);
        card.isFaceUp = flipCheckbox ? flipCheckbox.checked : false;
    }

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
        duration: stepDuration ? parseFloat(stepDuration.value) : 1.0,
        actions: []
    };

    appState.isEditingStep = true;
    appState.currentStepIndex = currentStep.stepId;

    if (finishStepBtn) finishStepBtn.disabled = false;
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
    currentStep.duration = stepDuration ? parseFloat(stepDuration.value) : 1.0;

    scenarioData.scenario.push(currentStep);

    // Save snapshot for replay and edit restore
    stepSnapshots.push(JSON.parse(JSON.stringify(endSnapshot)));

    appState.isEditingStep = false;
    currentStep = null;
    startSnapshot = null;

    if (finishStepBtn) finishStepBtn.disabled = true;
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

    // Save initial state as stepSnapshots[0] - this is "step 0" (before any actions)
    // This ensures replay can properly reset to initial positions on subsequent plays
    stepSnapshots.push(JSON.parse(JSON.stringify(scenarioData.initialState)));

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

        // Calculate AE positions for zones (since zone cards use x/y = 0 in UI)
        const getAEPosition = (state) => {
            if (state.zone && state.zone !== 'table') {
                return getAEZonePosition(state.zone, state.zonePosition);
            }
            return { x: Math.round(state.x || 0), y: Math.round(state.y || 0) };
        };

        // New card placed from tray (not in start snapshot)
        if (!start && end) {
            const endPos = getAEPosition(end);
            actions.push({
                targetId: card.id,
                type: 'PLACE',
                startPosition: { x: -500, y: PROJECT_INFO.height / 2 }, // Start from far left
                endPosition: endPos,
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

        const startPos = getAEPosition(start);
        const endPos = getAEPosition(end);

        // Only check position change if zone changed
        // Cards staying in same zone should NOT get new keyframes just from rearrangement
        const zoneChanged = end.zone !== start.zone;
        const posChanged = zoneChanged && (
            Math.abs(endPos.x - startPos.x) > 1 ||
            Math.abs(endPos.y - startPos.y) > 1
        );
        const rotChanged = Math.abs((end.rotation || 0) - (start.rotation || 0)) > 0.5;
        const flipChanged = end.isFaceUp !== start.isFaceUp;

        // IMPORTANT: Only apply flipAction/slamEffect if card actually moves (zone changed)
        // These flags are "sticky" on card objects, so we must NOT use them for stationary cards
        const hasFlipAction = zoneChanged && card.flipAction;
        const hasSlam = zoneChanged && card.slamEffect;

        if (posChanged || rotChanged || flipChanged || zoneChanged || hasFlipAction || hasSlam) {
            actions.push({
                targetId: card.id,
                type: 'TRANSFORM',
                startPosition: startPos,
                endPosition: endPos,
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
// COORDINATE TRANSFORMATION SYSTEM
// UI (1280x720) ↔ AE (1920x1080)
// ============================================

/**
 * Transform UI coordinates to AE coordinates
 * @param {number} uiX - X position in UI (1280x720)
 * @param {number} uiY - Y position in UI (1280x720)
 * @returns {object} {x, y} position for AE (1920x1080)
 */
function uiToAEPosition(uiX, uiY) {
    return {
        x: Math.round(uiX * COORD_SCALE),
        y: Math.round(uiY * COORD_SCALE)
    };
}

/**
 * Transform AE coordinates to UI coordinates
 * @param {number} aeX - X position in AE (1920x1080)
 * @param {number} aeY - Y position in AE (1920x1080)
 * @returns {object} {x, y} position for UI (1280x720)
 */
function aeToUIPosition(aeX, aeY) {
    return {
        x: Math.round(aeX / COORD_SCALE),
        y: Math.round(aeY / COORD_SCALE)
    };
}

/**
 * Get zone position in UI coordinates (relative to poker table)
 * @param {string} zoneName - Zone name
 * @param {number} zonePosition - Position within zone
 * @returns {object} {x, y} position in UI coordinates
 */
function getUIZonePosition(zoneName, zonePosition = 0) {
    const CARD_SPACING_UI = 45; // Card spacing in UI pixels

    // Handle grid zones (grid-place-X)
    if (zoneName && zoneName.startsWith('grid-')) {
        const placeId = zoneName.replace('grid-', '');

        // Try to get position from boardLayout.cardPlaces
        const place = appState.boardLayout.cardPlaces.find(p => p.id === placeId);
        if (place) {
            return { x: place.x, y: place.y };
        }

        // Fallback: get position from DOM element
        const zoneEl = document.querySelector(`.card-drop-zone[data-zone="${zoneName}"]`);
        if (zoneEl) {
            const pokerTable = document.getElementById('pokerTable');
            if (pokerTable) {
                const tableRect = pokerTable.getBoundingClientRect();
                const zoneRect = zoneEl.getBoundingClientRect();
                return {
                    x: zoneRect.left - tableRect.left + CARD_WIDTH / 2,
                    y: zoneRect.top - tableRect.top + CARD_HEIGHT / 2
                };
            }
        }

        return { x: UI_WIDTH / 2, y: UI_HEIGHT / 2 };
    }

    // Zone base positions in UI coordinates (1280x720)
    // These match the visual layout of the web tool
    const zonePositions = {
        'top': { x: UI_WIDTH / 2 - 50, y: 80 },
        'bottom': { x: UI_WIDTH / 2 - 50, y: UI_HEIGHT - 80 },
        'left': { x: 120, y: UI_HEIGHT / 2 },
        'right': { x: UI_WIDTH - 120, y: UI_HEIGHT / 2 },
        'community': { x: UI_WIDTH / 2 - 80, y: UI_HEIGHT / 2 }
    };

    const basePos = zonePositions[zoneName] || { x: UI_WIDTH / 2, y: UI_HEIGHT / 2 };

    // Calculate offset for multiple cards
    let offsetX = (zonePosition || 0) * CARD_SPACING_UI;
    let offsetY = 0;

    // Vertical zones (left/right) use Y offset
    if (zoneName === 'left' || zoneName === 'right') {
        offsetY = (zonePosition || 0) * CARD_SPACING_UI;
        offsetX = 0;
    }

    return {
        x: Math.round(basePos.x + offsetX),
        y: Math.round(basePos.y + offsetY)
    };
}

/**
 * Get zone position for AE export (transformed from UI to AE coordinates)
 * @param {string} zone - Zone name
 * @param {number} zonePosition - Position within zone
 * @returns {object} {x, y} position for AE (1920x1080)
 */
function getAEZonePosition(zone, zonePosition = 0) {
    const uiPos = getUIZonePosition(zone, zonePosition);
    return uiToAEPosition(uiPos.x, uiPos.y);
}


function saveInitialStateForExport() {
    // This version calculates positions for AE export
    const exportState = {};

    // Card scale for AE - 50% gives good visibility on 1080p
    const aeCardScale = 0.5;

    // Get the initial snapshot (step 0) to check which cards existed at start
    const initialSnap = stepSnapshots[0] || {};

    appState.tableCards.forEach(card => {
        // Check if card existed in the initial snapshot
        const wasInInitialSnap = initialSnap[card.id] !== undefined;

        // Calculate position based on zone
        let posX = card.x || 0;
        let posY = card.y || 0;

        if (!wasInInitialSnap) {
            // Card was added from tray during recording - start off-screen left
            posX = -500;
            posY = PROJECT_INFO.height / 2;
        } else if (card.zone && card.zone !== 'table') {
            // For zone cards, use calculated AE position
            const aePos = getAEZonePosition(card.zone, initialSnap[card.id].zonePosition || 0);
            posX = aePos.x;
            posY = aePos.y;
        }

        exportState[card.id] = {
            name: card.name,
            filename: card.filename,
            frontImage: card.filename,
            backImage: 'back.png',
            x: Math.round(posX),
            y: Math.round(posY),
            rotation: wasInInitialSnap ? (initialSnap[card.id].rotation || 0) : 0,
            scale: aeCardScale,
            zone: wasInInitialSnap ? initialSnap[card.id].zone : 'offscreen',
            zonePosition: wasInInitialSnap ? (initialSnap[card.id].zonePosition || 0) : 0,
            isFaceUp: wasInInitialSnap ? initialSnap[card.id].isFaceUp : false
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
        initialState: saveInitialStateForExport(),
        boardType: appState.boardLayout.type || 'poker',
        stepBlending: appState.stepBlending || 0  // Overlap % between steps
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
// PROJECT SAVE/LOAD
// ============================================

function handleSaveProject() {
    const projectData = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        deckPath: appState.deckPath,
        assetsRootPath: appState.assetsRootPath,
        stepBlending: appState.stepBlending,
        boardLayout: appState.boardLayout,
        // Save card states (without DOM elements)
        tableCards: appState.tableCards.map(c => ({
            id: c.id,
            name: c.name,
            displayName: c.displayName,
            filename: c.filename,
            frontImageUrl: c.frontImageUrl,
            backImageUrl: c.backImageUrl,
            suit: c.suit,
            rank: c.rank,
            isFaceUp: c.isFaceUp,
            zone: c.zone,
            zonePosition: c.zonePosition,
            rotation: c.rotation,
            x: c.x,
            y: c.y
        })),
        trayCards: appState.trayCards.map(c => ({
            id: c.id,
            name: c.name,
            displayName: c.displayName,
            filename: c.filename,
            frontImageUrl: c.frontImageUrl,
            backImageUrl: c.backImageUrl,
            suit: c.suit,
            rank: c.rank,
            isFaceUp: c.isFaceUp
        })),
        // Save scenario data
        scenarioData: {
            initialState: scenarioData.initialState,
            scenario: scenarioData.scenario
        },
        // Save step snapshots
        stepSnapshots: stepSnapshots
    };

    const dataStr = JSON.stringify(projectData, null, 2);

    // Use CEP file save dialog
    if (csInterface) {
        const defaultFilename = `autonim-poker-project-${Date.now()}.json`;
        const result = window.cep.fs.showSaveDialogEx(
            'Save Project',
            '',
            ['json'],
            defaultFilename
        );

        if (result.data && result.data.length > 0) {
            const filePath = result.data;
            const writeResult = window.cep.fs.writeFile(filePath, dataStr);

            if (writeResult.err === 0) {
                setStatus('Project saved to: ' + filePath.split(/[\\/]/).pop(), 'success');
            } else {
                setStatus('Failed to save project', 'error');
            }
        } else {
            setStatus('Save cancelled', '');
        }
    } else {
        // Fallback for browser testing
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `autonim-poker-project-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Project saved to Downloads', 'success');
    }
}

function handleLoadProject(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const projectData = JSON.parse(event.target.result);

            // Restore app state
            appState.deckPath = projectData.deckPath || null;
            appState.assetsRootPath = projectData.assetsRootPath || null;
            appState.stepBlending = projectData.stepBlending || 0;
            appState.boardLayout = projectData.boardLayout || appState.boardLayout;

            // Restore cards
            appState.tableCards = projectData.tableCards || [];
            appState.trayCards = projectData.trayCards || [];

            // Restore scenario
            if (projectData.scenarioData) {
                scenarioData.initialState = projectData.scenarioData.initialState || {};
                scenarioData.scenario = projectData.scenarioData.scenario || [];
            }

            // Restore snapshots
            if (projectData.stepSnapshots) {
                stepSnapshots.length = 0;
                projectData.stepSnapshots.forEach(s => stepSnapshots.push(s));
            }

            // Update UI
            updateAssetsDisplay();
            if (projectData.stepBlending) {
                const slider = document.getElementById('stepBlendingSlider');
                const value = document.getElementById('stepBlendingValue');
                if (slider) slider.value = projectData.stepBlending;
                if (value) value.textContent = projectData.stepBlending + '%';
            }

            // Re-render cards on table
            restoreFromSnapshot(stepSnapshots[stepSnapshots.length - 1] || {});

            // Update tray
            renderCardTray();
            renderTimeline();
            updateUI();

            setStatus('Project loaded!', 'success');
        } catch (err) {
            setStatus('Failed to load project: ' + err.message, 'error');
            console.error('Load project error:', err);
        }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
}

// ============================================
// TIMELINE
// ============================================

function renderTimeline() {
    // Use new TimelineUI if available
    if (typeof timelineUI !== 'undefined' && timelineUI !== null) {
        // Sync timing data first
        syncTimelineModulesWithSteps();
        return;
    }

    // Fallback to old rendering if TimelineUI not loaded
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
let replaySpeed = 1;  // 1 = normal, 2 = faster, 0.5 = slower

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

    // Update UI - old controls disabled, using new timeline controls
    // replayBtn.textContent = '⏸️ Pause';
    // replayControls.classList.remove('hidden');
    // replayProgress.textContent = `Initial / ${scenarioData.scenario.length} steps`;

    // Update playhead to start
    updateTimelinePlayhead(0);

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
    // Old progress display disabled - using playhead now
    // replayProgress.textContent = `Step ${currentReplayStep + 1}/${scenarioData.scenario.length}`;

    // Update playhead position (step start time)
    const playheadTime = step.startTime || currentReplayStep;
    updateTimelinePlayhead(playheadTime);

    // Get previous snapshot for start positions
    // stepSnapshots[0] = initial state, stepSnapshots[1] = after step 1, etc.
    const prevSnapshot = stepSnapshots[currentReplayStep];  // Start position
    const targetSnapshot = stepSnapshots[currentReplayStep + 1];  // End position

    if (targetSnapshot) {
        debugLog('Animating step from snapshot', currentReplayStep);

        // IMPORTANT: First restore cards to previous snapshot position
        // This ensures correct start positions on subsequent replays
        restoreFromSnapshot(prevSnapshot);

        // Find cards that changed position (zone changed) or are new
        const movingCards = [];
        Object.entries(targetSnapshot).forEach(([cardId, targetState]) => {
            const prevState = prevSnapshot[cardId];

            // New card added from tray (not in previous snapshot)
            if (!prevState) {
                movingCards.push({
                    cardId,
                    fromZone: null,  // Card is new, no previous zone
                    toZone: targetState.zone,
                    targetState,
                    isNew: true
                });
            } else if (prevState.zone !== targetState.zone) {
                // Existing card that moved zones
                movingCards.push({
                    cardId,
                    fromZone: prevState.zone,
                    toZone: targetState.zone,
                    targetState
                });
            }
        });

        debugLog('Moving cards:', movingCards.length);

        if (movingCards.length > 0) {
            // Small delay to let DOM settle after restore, then animate
            setTimeout(() => {
                animateCardsSequentially(movingCards, targetSnapshot, () => {
                    currentReplayStep++;
                    // Schedule next step
                    const duration = ((step.duration || 1) * 1000) / replaySpeed;
                    debugLog('Scheduling next step in', duration, 'ms (speed:', replaySpeed + 'x)');
                    replayTimer = setTimeout(() => replayNextStep(), duration);
                });
            }, 50);
        } else {
            // No movement, just restore and continue
            restoreFromSnapshot(targetSnapshot);
            currentReplayStep++;
            const duration = ((step.duration || 1) * 1000) / replaySpeed;
            replayTimer = setTimeout(() => replayNextStep(), duration);
        }
    } else {
        debugWarn('No stepSnapshot at index', currentReplayStep);
        currentReplayStep++;
        replayTimer = setTimeout(() => replayNextStep(), 1000);
    }
}

/**
 * Animate cards moving to new positions sequentially
 */
function animateCardsSequentially(movingCards, targetSnapshot, onComplete) {
    const ANIMATION_DURATION = 400; // ms per card
    let index = 0;

    // Calculate scale factor to convert UI coordinates (1280x720) to actual container size
    const pokerTable = document.getElementById('pokerTable');
    const tableWidth = pokerTable ? pokerTable.offsetWidth : gameContainer.offsetWidth;
    const tableHeight = pokerTable ? pokerTable.offsetHeight : gameContainer.offsetHeight;
    const scaleX = tableWidth / UI_WIDTH;
    const scaleY = tableHeight / UI_HEIGHT;

    debugLog('Animation scale factors:', { scaleX, scaleY, tableWidth, tableHeight, UI_WIDTH, UI_HEIGHT });

    function animateNext() {
        if (index >= movingCards.length) {
            // All animations complete, restore final state
            restoreFromSnapshot(targetSnapshot);
            onComplete();
            return;
        }

        const move = movingCards[index];
        let card = appState.tableCards.find(c => c.id === move.cardId);

        // For new cards (from tray), we need to find or create them
        if (move.isNew && !card) {
            // Find card in tray
            card = appState.trayCards.find(c => c.id === move.cardId);
            if (card) {
                // Add to table cards
                appState.tableCards.push(card);
                appState.trayCards = appState.trayCards.filter(c => c.id !== move.cardId);
            }
        }

        if (card) {
            // Create element if it doesn't exist
            if (!card.element) {
                const element = createCardOnTable(card, move.targetState.isFaceUp);
                card.element = element;
            }

            // Get start and end positions in UI coordinates (1280x720)
            const startPos = move.isNew
                ? { x: -100, y: UI_HEIGHT / 2 }  // Start from left edge
                : getUIZonePosition(move.fromZone);
            const endPos = getUIZonePosition(move.toZone);

            // Get poker table offset relative to gameContainer
            const containerRect = gameContainer.getBoundingClientRect();
            const tableRect = pokerTable ? pokerTable.getBoundingClientRect() : containerRect;
            const offsetX = tableRect.left - containerRect.left;
            const offsetY = tableRect.top - containerRect.top;

            // Scale card dimensions as well
            const scaledCardWidth = CARD_WIDTH * scaleX;
            const scaledCardHeight = CARD_HEIGHT * scaleY;

            // Remove from zone container, add to gameContainer for free movement
            const cardEl = card.element;
            cardEl.style.position = 'absolute';
            // Scale UI coordinates to actual container size
            cardEl.style.left = `${offsetX + (startPos.x * scaleX) - scaledCardWidth / 2}px`;
            cardEl.style.top = `${offsetY + (startPos.y * scaleY) - scaledCardHeight / 2}px`;
            cardEl.style.zIndex = '200';
            cardEl.style.transition = `left ${ANIMATION_DURATION}ms ease, top ${ANIMATION_DURATION}ms ease`;

            // Move to gameContainer if not already there
            if (cardEl.parentElement !== gameContainer) {
                gameContainer.appendChild(cardEl);
            }

            debugLog(`Animating ${card.id}: from (${startPos.x}, ${startPos.y}) to (${endPos.x}, ${endPos.y})${move.isNew ? ' [NEW]' : ''}`);

            // Trigger animation
            requestAnimationFrame(() => {
                cardEl.style.left = `${offsetX + (endPos.x * scaleX) - scaledCardWidth / 2}px`;
                cardEl.style.top = `${offsetY + (endPos.y * scaleY) - scaledCardHeight / 2}px`;
            });

            // Wait for animation, then animate next
            setTimeout(() => {
                index++;
                animateNext();
            }, ANIMATION_DURATION + 50);
        } else {
            index++;
            animateNext();
        }
    }

    animateNext();
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
    // Also clear grid drop zones
    document.querySelectorAll('.card-drop-zone .zone-cards').forEach(container => {
        container.innerHTML = '';
    });
    // Clear community zone
    const communityZoneContainer = document.querySelector('.community-zone .zone-cards');
    if (communityZoneContainer) communityZoneContainer.innerHTML = '';

    // Clear ALL card elements ANYWHERE in gameContainer (nuclear cleanup)
    // This ensures animated cards are removed regardless of DOM location
    // Must include both .card (table cards) and .zone-card (zone cards) classes
    gameContainer.querySelectorAll('.card, .zone-card').forEach(cardEl => {
        cardEl.remove();
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

    // Re-create elements ONLY for cards in the initial state
    // Filter tableCards to only include those in initialState
    const initialStateCardIds = Object.keys(scenarioData.initialState);
    const cardsInInitialState = appState.tableCards.filter(c => initialStateCardIds.includes(c.id));

    // Sort by zone and zonePosition to ensure correct order
    const sortedCards = cardsInInitialState.sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.zonePosition || 0) - (b.zonePosition || 0);
    });

    debugLog('sortedCards for rendering:', sortedCards.map(c => ({ id: c.id, zone: c.zone })));

    sortedCards.forEach(card => {
        try {
            if (card.zone && card.zone !== 'table') {
                // Use specific selectors to target zone divs (including grid drop zones)
                const zoneElement = document.querySelector(`.player-zone[data-zone="${card.zone}"], .community-zone[data-zone="${card.zone}"], .card-drop-zone[data-zone="${card.zone}"]`);
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
    // Also clear grid drop zones
    document.querySelectorAll('.card-drop-zone .zone-cards').forEach(container => {
        container.innerHTML = '';
    });
    // Clear community zone
    const communityZone = document.querySelector('.community-zone .zone-cards');
    if (communityZone) communityZone.innerHTML = '';

    // Clear ALL card elements ANYWHERE in gameContainer (nuclear cleanup)
    // This ensures animated cards are removed regardless of DOM location
    // Must include both .card (table cards) and .zone-card (zone cards) classes
    gameContainer.querySelectorAll('.card, .zone-card').forEach(cardEl => {
        cardEl.remove();
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

    // Re-create elements ONLY for cards in the snapshot
    // Filter tableCards to only include those in the snapshot
    const snapshotCardIds = Object.keys(snapshot);
    const cardsInSnapshot = appState.tableCards.filter(c => snapshotCardIds.includes(c.id));

    // Sort by zone and zonePosition to ensure correct order
    const sortedCards = cardsInSnapshot.sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.zonePosition || 0) - (b.zonePosition || 0);
    });

    debugLog('sortedCards for rendering:', sortedCards.map(c => ({ id: c.id, zone: c.zone })));

    sortedCards.forEach(card => {
        if (card.zone && card.zone !== 'table') {
            // Use specific selectors to target zone divs (including grid drop zones)
            const zoneElement = document.querySelector(`.player-zone[data-zone="${card.zone}"], .community-zone[data-zone="${card.zone}"], .card-drop-zone[data-zone="${card.zone}"]`);
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
            duration: stepDuration ? parseFloat(stepDuration.value) : 1.0,
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

    // Always flip the card visually when toggle changes
    // Enable flipAction: shows END state (flipped)
    // Disable flipAction: flips back to original state
    flipCard(appState.selectedCard);


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

// ============================================
// BOARD SETTING FUNCTIONS
// ============================================

/**
 * Load preset from file or predefined presets
 */
function handleLoadPreset() {
    const presetValue = presetSelect.value;

    if (presetValue === 'poker') {
        loadPokerLayout();
    } else if (presetValue === 'card-sorting') {
        loadGridLayout(4, 3);
    } else if (presetValue === 'custom') {
        // Keep current custom layout
        setStatus('Custom layout - modify as needed');
    }

    updateCardPlacesList();
    renderCardPlaceMarkers();
}

/**
 * Load default poker layout
 */
function loadPokerLayout() {
    appState.boardLayout = {
        type: 'poker',
        name: 'Poker (4 Players)',
        gridCols: 0,
        gridRows: 0,
        cardPlaces: []
    };

    gameContainer.classList.remove('grid-mode');
    setStatus('Loaded Poker layout (4 player zones + community)');
}

/**
 * Load grid layout with specified columns and rows
 */
function loadGridLayout(cols, rows) {
    const places = [];

    // Use pokerTable dimensions (same reference as drag handler)
    const pokerTable = document.getElementById('pokerTable');
    const tableWidth = pokerTable ? pokerTable.offsetWidth : 600;
    const tableHeight = pokerTable ? pokerTable.offsetHeight : 400;

    // Calculate spacing based on card dimensions and table size
    const spacingX = 80;
    const spacingY = 100;
    const startX = (tableWidth - (cols * spacingX)) / 2 + CARD_WIDTH / 2;
    const startY = (tableHeight - (rows * spacingY)) / 2 + CARD_HEIGHT / 2;

    let placeId = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            places.push({
                id: `place-${placeId}`,
                x: startX + col * spacingX,
                y: startY + row * spacingY,
                col: col,
                row: row,
                label: String(placeId + 1)
            });
            placeId++;
        }
    }

    appState.boardLayout = {
        type: 'grid',
        name: `Card Sorting (${cols}x${rows})`,
        gridCols: cols,
        gridRows: rows,
        cardPlaces: places
    };

    gameContainer.classList.add('grid-mode');
    setStatus(`Loaded ${cols}x${rows} grid layout`);
}

/**
 * Apply grid size from input fields
 */
function handleApplyGrid() {
    const cols = parseInt(gridCols.value) || 4;
    const rows = parseInt(gridRows.value) || 3;

    loadGridLayout(cols, rows);
    updateCardPlacesList();
    renderCardPlaceMarkers();
}

/**
 * Add a single card place at center
 */
function handleAddCardPlace() {
    const containerWidth = gameContainer.offsetWidth || 800;
    const containerHeight = gameContainer.offsetHeight || 450;

    const newId = appState.boardLayout.cardPlaces.length;
    const newPlace = {
        id: `place-${newId}`,
        x: containerWidth / 2,
        y: containerHeight / 2,
        label: String(newId + 1)
    };

    appState.boardLayout.cardPlaces.push(newPlace);
    appState.boardLayout.type = 'grid';

    updateCardPlacesList();
    renderCardPlaceMarkers();
    setStatus(`Added card place #${newId + 1}`);
}

/**
 * Clear all card places
 */
function handleClearBoard() {
    appState.boardLayout.cardPlaces = [];
    updateCardPlacesList();
    renderCardPlaceMarkers();
    setStatus('Cleared all card places');
}

/**
 * Save current layout as preset JSON
 */
function handleSavePreset() {
    const name = presetName.value.trim() || 'Custom Layout';

    const presetData = {
        name: name,
        type: appState.boardLayout.type,
        description: `Saved preset: ${name}`,
        gridCols: appState.boardLayout.gridCols,
        gridRows: appState.boardLayout.gridRows,
        cardPlaces: appState.boardLayout.cardPlaces.map(p => ({
            id: p.id,
            x: Math.round(p.x),
            y: Math.round(p.y),
            label: p.label
        }))
    };

    // Try to save to file system (CEP mode)
    if (fs && appState.decksFolder) {
        const presetsFolder = appState.decksFolder.replace('/decks', '/presets');
        const filename = name.toLowerCase().replace(/\s+/g, '-') + '.json';
        const filepath = presetsFolder + '/' + filename;

        try {
            // Ensure presets folder exists
            if (!fs.existsSync(presetsFolder)) {
                fs.mkdirSync(presetsFolder, { recursive: true });
            }

            fs.writeFileSync(filepath, JSON.stringify(presetData, null, 2));
            setStatus(`Preset saved: ${filename}`, 'success');
        } catch (e) {
            console.error('Error saving preset:', e);
            // Fallback: download as file
            downloadPresetJSON(presetData, filename);
        }
    } else {
        // Browser mode: download as file
        const filename = name.toLowerCase().replace(/\s+/g, '-') + '.json';
        downloadPresetJSON(presetData, filename);
    }
}

/**
 * Download preset as JSON file (browser fallback)
 */
function downloadPresetJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    setStatus(`Preset downloaded: ${filename}`, 'success');
}

/**
 * Render card place markers on the game container
 */
function renderCardPlaceMarkers() {
    // Clear existing markers
    clearCardPlaceMarkers();

    if (appState.boardLayout.type !== 'grid' || appState.boardLayout.cardPlaces.length === 0) {
        return;
    }

    // Render markers in gameContainer (not pokerTable) so they appear above the table
    if (!gameContainer) return;

    // Get poker table position for offset calculation
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) return;

    const tableRect = pokerTable.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    // Calculate offset from gameContainer to pokerTable
    const offsetX = tableRect.left - containerRect.left;
    const offsetY = tableRect.top - containerRect.top;

    appState.boardLayout.cardPlaces.forEach((place, index) => {
        const marker = document.createElement('div');
        marker.className = 'card-place-marker';
        marker.dataset.placeId = place.id;

        // Position relative to gameContainer (add pokerTable offset)
        marker.style.left = `${offsetX + place.x - CARD_WIDTH / 2}px`;
        marker.style.top = `${offsetY + place.y - CARD_HEIGHT / 2}px`;

        // Place number
        const number = document.createElement('span');
        number.className = 'place-number';
        number.textContent = place.label || String(index + 1);
        marker.appendChild(number);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'marker-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCardPlace(place.id);
        });
        marker.appendChild(deleteBtn);

        // Make draggable
        marker.addEventListener('mousedown', (e) => startDragMarker(e, place, marker));

        // Click to select
        marker.addEventListener('click', () => selectCardPlace(place, marker));

        gameContainer.appendChild(marker);
    });
}

/**
 * Clear all card place markers from DOM
 */
function clearCardPlaceMarkers() {
    const markers = document.querySelectorAll('.card-place-marker');
    markers.forEach(m => m.remove());
}

/**
 * Render card drop zones for Setup mode (non-editable)
 */
function renderCardDropZones() {
    // Clear existing drop zones
    clearCardDropZones();

    if (appState.boardLayout.type !== 'grid' || appState.boardLayout.cardPlaces.length === 0) {
        return;
    }

    if (!gameContainer) return;

    // Get poker table position for offset calculation
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) return;

    const tableRect = pokerTable.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    const offsetX = tableRect.left - containerRect.left;
    const offsetY = tableRect.top - containerRect.top;

    appState.boardLayout.cardPlaces.forEach((place, index) => {
        const zone = document.createElement('div');
        zone.className = 'card-drop-zone';
        zone.dataset.placeId = place.id;
        zone.dataset.zone = `grid-${place.id}`;
        zone.dataset.rotation = '0';

        // Position relative to gameContainer
        zone.style.left = `${offsetX + place.x - CARD_WIDTH / 2}px`;
        zone.style.top = `${offsetY + place.y - CARD_HEIGHT / 2}px`;

        // Zone label
        const label = document.createElement('span');
        label.className = 'zone-number';
        label.textContent = place.label || String(index + 1);
        zone.appendChild(label);

        // Cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'zone-cards';
        zone.appendChild(cardsContainer);

        // Add drop event handlers
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => handleZoneDrop(e, zone));

        gameContainer.appendChild(zone);
    });

    // Restore existing cards in grid zones
    restoreGridCards();
}

/**
 * Restore cards that are already in grid zones after re-rendering drop zones
 */
function restoreGridCards() {
    const gridCards = appState.tableCards.filter(c => c.zone && c.zone.startsWith('grid-'));

    gridCards.forEach(card => {
        const zoneElement = document.querySelector(`.card-drop-zone[data-zone="${card.zone}"]`);
        if (zoneElement) {
            createZoneCardElement(card, zoneElement);
        }
    });
}

/**
 * Clear all card drop zones from DOM
 */
function clearCardDropZones() {
    const zones = document.querySelectorAll('.card-drop-zone');
    zones.forEach(z => z.remove());
}

/**
 * Delete a card place by ID
 */
function deleteCardPlace(placeId) {
    appState.boardLayout.cardPlaces = appState.boardLayout.cardPlaces.filter(p => p.id !== placeId);

    // Re-label remaining places
    appState.boardLayout.cardPlaces.forEach((p, idx) => {
        p.label = String(idx + 1);
    });

    updateCardPlacesList();
    renderCardPlaceMarkers();
    setStatus('Card place deleted');
}

/**
 * Select a card place marker
 */
function selectCardPlace(place, markerElement) {
    // Deselect previous
    document.querySelectorAll('.card-place-marker.selected').forEach(m => m.classList.remove('selected'));

    appState.selectedCardPlace = place;
    if (markerElement) {
        markerElement.classList.add('selected');
    }
}

/**
 * Start dragging a marker
 */
function startDragMarker(e, place, marker) {
    if (e.button !== 0) return; // Left click only

    e.preventDefault();
    marker.classList.add('dragging');

    const pokerTable = document.getElementById('pokerTable');
    const tableRect = pokerTable.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    // Calculate offset from gameContainer to pokerTable
    const offsetX = tableRect.left - containerRect.left;
    const offsetY = tableRect.top - containerRect.top;

    const startX = e.clientX;
    const startY = e.clientY;
    // Store start position in container coordinates (place.x/y are relative to poker table)
    const startMarkerLeft = offsetX + place.x - CARD_WIDTH / 2;
    const startMarkerTop = offsetY + place.y - CARD_HEIGHT / 2;

    function onMouseMove(moveE) {
        const dx = moveE.clientX - startX;
        const dy = moveE.clientY - startY;

        // New position in container coordinates
        let newLeft = startMarkerLeft + dx;
        let newTop = startMarkerTop + dy;

        // Constrain to game container bounds (not poker table)
        newLeft = Math.max(0, Math.min(containerRect.width - CARD_WIDTH, newLeft));
        newTop = Math.max(0, Math.min(containerRect.height - CARD_HEIGHT, newTop));

        // Update marker position
        marker.style.left = `${newLeft}px`;
        marker.style.top = `${newTop}px`;

        // Convert back to poker table relative coordinates for storage
        place.x = newLeft - offsetX + CARD_WIDTH / 2;
        place.y = newTop - offsetY + CARD_HEIGHT / 2;
    }

    function onMouseUp() {
        marker.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        updateCardPlacesList();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Update the card places list in the director panel
 */
function updateCardPlacesList() {
    if (!cardPlacesList) return;

    const count = appState.boardLayout.cardPlaces.length;
    cardPlacesList.innerHTML = `<div class="list-header">Card Places (${count})</div>`;

    appState.boardLayout.cardPlaces.forEach((place, index) => {
        const item = document.createElement('div');
        item.className = 'card-place-item';
        item.innerHTML = `
            <span class="place-label">${place.label || index + 1}</span>
            <span class="place-coords">(${Math.round(place.x)}, ${Math.round(place.y)})</span>
            <button class="delete-place-btn" data-place-id="${place.id}">✕</button>
        `;

        // Delete button handler
        item.querySelector('.delete-place-btn').addEventListener('click', () => {
            deleteCardPlace(place.id);
        });

        cardPlacesList.appendChild(item);
    });
}

// ============================================
// TIMELINE MODULES INTEGRATION
// ============================================

// Module instances (lazy init)
let timelineModules = null;
let timelineUI = null;

/**
 * Initialize timeline modules integration
 * This is called from init() and sets up all new timeline functionality
 */
function initTimelineModulesIntegration() {
    // Check if modules are available
    if (typeof TIMELINE_FEATURE_FLAGS === 'undefined') {
        console.log('[Timeline] Modules not loaded - skipping initialization');
        return;
    }

    if (!TIMELINE_FEATURE_FLAGS.ENABLED) {
        console.log('[Timeline] Modules disabled via feature flag');
        return;
    }

    console.log('[Timeline] Initializing modules integration...');

    try {
        // Initialize core modules
        timelineModules = initTimelineModules(
            scenarioData,
            stepSnapshots,
            restoreFromSnapshot
        );

        if (!timelineModules) {
            console.warn('[Timeline] Module initialization returned null');
            return;
        }

        // Initialize Timeline UI if container exists
        const timelineBar = document.getElementById('timelineBar');
        if (timelineBar && TIMELINE_FEATURE_FLAGS.TIMELINE_UI) {
            timelineUI = new TimelineUI(timelineBar, {
                timelineManager: timelineModules.timelineManager,
                playbackController: timelineModules.playbackController,
                onStepSelect: handleTimelineStepSelect,
                onStepEdit: handleTimelineStepEdit,
                onStepMove: handleTimelineStepMove
            });

            // Initial render
            timelineUI.render();
            console.log('[Timeline] UI initialized');
        }

        // Hook into existing functions to sync with timeline modules
        hookTimelineFunctions();

        // Run tests in development
        if (typeof TIMELINE_FEATURE_FLAGS !== 'undefined' && location.hostname === 'localhost') {
            // Uncomment to run tests automatically
            // timelineModules.runTests();
        }

        console.log('[Timeline] Integration complete');

    } catch (error) {
        console.error('[Timeline] Error initializing modules:', error);
    }
}

/**
 * Hook into existing functions to sync timeline modules
 */
function hookTimelineFunctions() {
    if (!timelineModules) return;

    const { timelineManager, snapshotManager, stepPropertyManager } = timelineModules;

    // Hook handleFinishStep to sync with timeline manager
    const originalHandleFinishStep = handleFinishStep;
    handleFinishStep = function () {
        // Call original implementation
        originalHandleFinishStep();

        // Sync with timeline modules after step is created
        syncTimelineModulesWithSteps();
    };

    // Hook property changes for per-step property storage
    if (TIMELINE_FEATURE_FLAGS.PER_STEP_PROPS) {
        const originalHandlePropertyChange = handlePropertyChange;
        handlePropertyChange = function () {
            // Store in per-step manager during editing
            if (appState.isEditingStep && appState.selectedCard) {
                const cardId = appState.selectedCard.id;
                const stepIndex = appState.currentStepIndex;

                stepPropertyManager.setPendingProperty(cardId, 'flip', {
                    enabled: flipCardCheck.checked,
                    toFaceUp: appState.selectedCard.isFaceUp
                });

                stepPropertyManager.setPendingProperty(cardId, 'slam', {
                    enabled: slamEffectCheck.checked
                });
            }

            // Still call original to update card object
            originalHandlePropertyChange();
        };
    }

    // Hook handleAutoStepYes to sync with snapshotManager
    const originalHandleAutoStepYes = handleAutoStepYes;
    handleAutoStepYes = function () {
        // Call original implementation
        originalHandleAutoStepYes();

        // Sync with timeline modules after step is created
        syncTimelineModulesWithSteps();
    };

    // Hook handleFinishStep that we already defined above also needs to sync
    // The handleFinishStep hook is already defined above, but let's make sure
    // auto-step also triggers timeline UI update

    console.log('[Timeline] Functions hooked');
}

/**
 * Get step color (cycling through palette)
 */
function getStepColor(stepId) {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722'];
    return colors[(stepId - 1) % colors.length];
}

/**
 * Handle timeline step selection
 */
function handleTimelineStepSelect(step, index) {
    console.log('[Timeline] Step selected:', step.stepId);

    // Jump playback to this step
    if (timelineModules && timelineModules.playbackController) {
        timelineModules.playbackController.jumpToStep(index);
    }

    // Highlight in existing timeline preview
    const existingBlocks = document.querySelectorAll('.timeline-step');
    existingBlocks.forEach(block => block.classList.remove('selected'));
}

/**
 * Handle timeline step edit request
 */
function handleTimelineStepEdit(step, index) {
    console.log('[Timeline] Edit requested for step:', step.stepId);

    // Show warning if there are subsequent steps
    if (index < scenarioData.scenario.length - 1) {
        showWarningModal(`Editing Step ${step.stepId} may affect subsequent steps. Continue?`, () => {
            startEditingStep(index);
        });
    } else {
        startEditingStep(index);
    }
}

/**
 * Start editing an existing step
 */
function startEditingStep(stepIndex) {
    if (appState.isEditingStep) {
        setStatus('Finish current step first', 'error');
        return;
    }

    // Restore to state before this step
    const snapshot = stepSnapshots[stepIndex];
    if (snapshot) {
        restoreFromSnapshot(snapshot);
    }

    // Enter edit mode
    appState.isEditingStep = true;
    appState.currentStepIndex = stepIndex;

    const step = scenarioData.scenario[stepIndex];
    currentStep = JSON.parse(JSON.stringify(step));
    startSnapshot = snapshot;

    // Update UI
    if (stepDuration) stepDuration.value = step.duration || 1.0;
    if (finishStepBtn) {
        finishStepBtn.disabled = false;
        finishStepBtn.textContent = '✓ Update Step';
    }
    if (addStepBtn) addStepBtn.disabled = true;
    if (recordingIndicator) recordingIndicator.classList.add('active');
    if (currentStepNum) currentStepNum.textContent = step.stepId;

    setStatus(`Editing Step ${step.stepId} - Move cards and click Update`, 'recording');
}

/**
 * Handle timeline step move (drag)
 */
function handleTimelineStepMove(step) {
    console.log('[Timeline] Step moved:', step.stepId, 'to', step.startTime);
    // Timeline manager already updated the step
    // Just need to re-render existing timeline if needed
    renderTimeline();
}

/**
 * Show warning modal
 */
function showWarningModal(message, onConfirm) {
    if (warningModal && warningMessage) {
        warningMessage.textContent = message;
        warningModal.classList.remove('hidden');

        // Store callback
        warningModal._onConfirm = onConfirm;
    }
}

/**
 * Refresh timeline UI
 */
function refreshTimelineUI() {
    if (timelineUI) {
        timelineUI.render();
    }
}

/**
 * Sync timeline modules with current step data
 * Called after any step is created or modified
 */
function syncTimelineModulesWithSteps() {
    if (!timelineModules) {
        console.log('[Timeline] No modules to sync');
        return;
    }

    const { snapshotManager, timelineManager } = timelineModules;

    // Sync snapshots from stepSnapshots array to snapshotManager
    if (stepSnapshots.length > 0) {
        console.log('[Timeline] Syncing', stepSnapshots.length, 'snapshots');
        snapshotManager.loadFromArray(stepSnapshots);
    }

    // Sync step timing
    if (scenarioData.scenario.length > 0) {
        let currentTime = 0;
        scenarioData.scenario.forEach((step) => {
            if (step.startTime === undefined) {
                step.startTime = currentTime;
            }
            if (step.endTime === undefined) {
                step.endTime = step.startTime + (step.duration || 1.0);
            }
            if (!step.label) step.label = `Step ${step.stepId}`;
            if (!step.color) step.color = getStepColor(step.stepId);
            currentTime = step.endTime;
        });

        // Update timeline total duration
        if (scenarioData.timeline) {
            scenarioData.timeline.totalDuration = currentTime;
        }
    }

    // Update timeline UI
    if (timelineUI) {
        timelineUI.render();
    }

    console.log('[Timeline] Sync complete. Steps:', scenarioData.scenario.length, 'Snapshots:', snapshotManager.getSnapshotCount());
}

/**
 * Update timeline playhead position
 * @param {number} time - Current time in seconds
 */
function updateTimelinePlayhead(time) {
    // Update TimelineUI playhead
    if (timelineUI && timelineUI._updatePlayhead) {
        timelineUI._updatePlayhead(time);
    }

    // Also update the time display elements directly
    const currentTimeEl = document.getElementById('tlCurrentTime');
    if (currentTimeEl) {
        currentTimeEl.textContent = time.toFixed(1);
    }
}
