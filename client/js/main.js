/**
 * Autonim-Poker - Director Tool
 * Pose-to-Pose Animation Recording for After Effects
 * 
 * Features:
 * - Import card images from folder using Node.js fs/path
 * - Draggable cards with transform-based positioning
 * - Pose-to-Pose recording: Snapshot → Edit → Finish Step
 * - Export scenario JSON for After Effects
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
let fs, path;
try {
    fs = require('fs');
    path = require('path');
} catch (e) {
    console.warn('Node.js modules not available');
    fs = null;
    path = null;
}

// Application Mode
window.appMode = 'recording'; // 'recording' or 'play'

// Project Info (Reference dimensions 1920x1080)
const PROJECT_INFO = {
    width: 1920,
    height: 1080,
    fps: 30
};

// Application State
const appState = {
    cards: [],                    // Array of card objects
    selectedCard: null,           // Currently selected card
    isEditingStep: false,         // Is currently editing a step
    currentStepIndex: -1,         // Current step being edited
    deckPath: null,               // Path to imported deck folder
    assetsRootPath: null          // Root path for assets (for AE)
};

// Scenario Data (will be exported)
const scenarioData = {
    projectInfo: PROJECT_INFO,
    initialState: {},             // Initial positions of all cards
    scenario: []                  // Array of steps
};

// Current Step being edited
let currentStep = null;
let startSnapshot = null;         // Snapshot when step started

// Supported image formats
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

// ============================================
// DOM ELEMENTS
// ============================================

let importDeckBtn, resetBtn, folderInput;
let gameContainer, pokerTable, cardArea, tableInstructions;
let cardCountEl, actionCountEl, statusMessage;
let directorPanel, addStepBtn, finishStepBtn, stepDuration;
let currentStepNum, totalSteps, timelinePreview;
let noCardSelected, cardProperties, selectedCardName;
let flipCardCheck, slamEffectCheck;
let cardPosX, cardPosY, cardRot;
let exportJsonBtn, exportToAEBtn;
let recordingIndicator;
let playModeBtn, recordModeBtn;
let selectAssetsFolderBtn, assetsPathDisplay;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

function init() {
    // Get DOM elements
    importDeckBtn = document.getElementById('importDeckBtn');
    resetBtn = document.getElementById('resetBtn');
    folderInput = document.getElementById('folderInput');
    gameContainer = document.getElementById('gameContainer');
    pokerTable = document.getElementById('pokerTable');
    cardArea = document.getElementById('cardArea');
    tableInstructions = document.getElementById('tableInstructions');
    cardCountEl = document.getElementById('cardCount');
    actionCountEl = document.getElementById('actionCount');
    statusMessage = document.getElementById('statusMessage');
    recordingIndicator = document.getElementById('recordingIndicator');

    // Director Panel elements
    directorPanel = document.getElementById('directorPanel');
    addStepBtn = document.getElementById('addStepBtn');
    finishStepBtn = document.getElementById('finishStepBtn');
    stepDuration = document.getElementById('stepDuration');
    currentStepNum = document.getElementById('currentStepNum');
    totalSteps = document.getElementById('totalSteps');
    timelinePreview = document.getElementById('timelinePreview');
    noCardSelected = document.getElementById('noCardSelected');
    cardProperties = document.getElementById('cardProperties');
    selectedCardName = document.getElementById('selectedCardName');
    flipCardCheck = document.getElementById('flipCardCheck');
    slamEffectCheck = document.getElementById('slamEffectCheck');
    cardPosX = document.getElementById('cardPosX');
    cardPosY = document.getElementById('cardPosY');
    cardRot = document.getElementById('cardRot');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    exportToAEBtn = document.getElementById('exportToAEBtn');
    playModeBtn = document.getElementById('playModeBtn');
    recordModeBtn = document.getElementById('recordModeBtn');
    selectAssetsFolderBtn = document.getElementById('selectAssetsFolderBtn');
    assetsPathDisplay = document.getElementById('assetsPathDisplay');

    // Bind event listeners
    bindEvents();

    // Update UI
    updateUI();

    console.log('Autonim-Poker Director Tool initialized');
    setStatus('Ready - Import a deck to start recording');
}

function bindEvents() {
    // Project Settings
    selectAssetsFolderBtn.addEventListener('click', handleSelectAssetsFolder);

    // Import / Reset
    importDeckBtn.addEventListener('click', () => folderInput.click());
    folderInput.addEventListener('change', handleFolderSelect);
    resetBtn.addEventListener('click', handleReset);

    // Step Controls
    addStepBtn.addEventListener('click', handleAddStep);
    finishStepBtn.addEventListener('click', handleFinishStep);

    // Action Properties
    flipCardCheck.addEventListener('change', handleActionPropertyChange);
    slamEffectCheck.addEventListener('change', handleActionPropertyChange);

    // Export
    exportJsonBtn.addEventListener('click', handleExportJSON);
    exportToAEBtn.addEventListener('click', handleExportToAE);

    // Mode switching
    playModeBtn.addEventListener('click', () => setAppMode('play'));
    recordModeBtn.addEventListener('click', () => setAppMode('recording'));

    // Click outside cards to deselect
    cardArea.addEventListener('click', (e) => {
        if (e.target === cardArea) {
            deselectCard();
        }
    });
}

// ============================================
// MODE SWITCHING
// ============================================

function setAppMode(mode) {
    window.appMode = mode;

    if (mode === 'recording') {
        directorPanel.classList.remove('hidden');
        recordModeBtn.classList.add('active');
        playModeBtn.classList.remove('active');
    } else {
        directorPanel.classList.add('hidden');
        playModeBtn.classList.add('active');
        recordModeBtn.classList.remove('active');
    }

    updateUI();
}

// ============================================
// ASSETS FOLDER SELECTION (CEP API)
// ============================================

/**
 * Handle selecting assets folder using CEP file dialog
 * Uses window.cep.fs.showOpenDialog for folder selection
 */
function handleSelectAssetsFolder() {
    // Check if running in CEP environment
    if (typeof window.cep === 'undefined' || !window.cep.fs) {
        // Fallback for browser testing - prompt for path
        const manualPath = prompt('Enter assets folder path (CEP not available):', 'D:/Projects/Assets');
        if (manualPath) {
            setAssetsPath(manualPath);
        }
        return;
    }

    // CEP showOpenDialog parameters
    const dialogTitle = 'Select Assets Folder';
    const initialPath = appState.deckPath || '';
    const fileTypes = []; // Empty for folder selection
    const defaultExtension = '';
    const friendlyDescription = '';
    const allowMultiple = false;
    const isFolder = true; // This flag tells CEP to select folders

    // Use CEP's showOpenDialogEx for folder selection
    try {
        const result = window.cep.fs.showOpenDialogEx(
            false,          // allowMultipleSelection
            true,           // chooseDirectory (folder mode)
            dialogTitle,    // title
            initialPath,    // initialPath
            fileTypes       // fileTypes (ignored for folder)
        );

        // Check result
        if (result.err === 0 && result.data && result.data.length > 0) {
            const selectedPath = result.data[0];
            setAssetsPath(selectedPath);
        } else if (result.err !== 0) {
            console.warn('Folder selection cancelled or error:', result.err);
        }
    } catch (e) {
        console.error('Error opening folder dialog:', e);

        // Fallback: try alternative method
        try {
            const result = window.cep.fs.showOpenDialog(
                false,          // allowMultipleSelection
                true,           // chooseDirectory
                dialogTitle,    // title
                initialPath     // initialPath
            );

            if (result.err === 0 && result.data && result.data.length > 0) {
                setAssetsPath(result.data[0]);
            }
        } catch (e2) {
            console.error('Fallback folder dialog also failed:', e2);
            setStatus('Error opening folder dialog', 'error');
        }
    }
}

/**
 * Set the assets root path and update UI
 * @param {string} folderPath - Selected folder path
 */
function setAssetsPath(folderPath) {
    if (!folderPath) return;

    // Normalize path (ensure forward slashes for script compatibility)
    let normalizedPath = folderPath.replace(/\\/g, '/');

    // Ensure trailing slash
    if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
    }

    // Store in app state
    appState.assetsRootPath = normalizedPath;

    // Update UI display
    updateAssetsPathDisplay(normalizedPath);

    setStatus(`Assets folder set: ${getShortPath(normalizedPath)}`, 'success');
    console.log('Assets root path set to:', normalizedPath);
}

/**
 * Update the assets path display in UI
 * @param {string} fullPath - Full folder path
 */
function updateAssetsPathDisplay(fullPath) {
    if (!assetsPathDisplay) return;

    // Clear existing content
    assetsPathDisplay.innerHTML = '';
    assetsPathDisplay.classList.add('has-path');

    // Create path display elements
    const labelSpan = document.createElement('span');
    labelSpan.className = 'path-label';
    labelSpan.textContent = '✓ ';

    const pathSpan = document.createElement('span');
    pathSpan.className = 'path-value';
    pathSpan.textContent = getShortPath(fullPath);
    pathSpan.title = fullPath; // Show full path on hover

    assetsPathDisplay.appendChild(labelSpan);
    assetsPathDisplay.appendChild(pathSpan);
}

/**
 * Get shortened path for display
 * @param {string} fullPath - Full path string
 * @returns {string} Shortened path
 */
function getShortPath(fullPath) {
    // Show just the last 2-3 directory levels
    const parts = fullPath.replace(/\/$/, '').split('/');
    if (parts.length <= 3) {
        return fullPath;
    }
    return '.../' + parts.slice(-2).join('/') + '/';
}

// ============================================
// FILE SYSTEM - IMPORT DECK
// ============================================

function handleFolderSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Get the folder path from first file
    const firstFile = files[0];
    let folderPath = '';

    if (path && firstFile.path) {
        folderPath = path.dirname(firstFile.path);
        appState.deckPath = folderPath;
    }

    setStatus(`Loading images...`, 'recording');

    try {
        const imageFiles = [];

        // Iterate through selected files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

            if (SUPPORTED_FORMATS.includes(ext)) {
                imageFiles.push({
                    name: file.name,
                    path: file.path || URL.createObjectURL(file),
                    baseName: file.name.substring(0, file.name.lastIndexOf('.'))
                });
            }
        }

        if (imageFiles.length === 0) {
            setStatus('No image files found in folder', 'error');
            return;
        }

        // Clear existing cards
        clearCards();

        // Create cards from images
        createCardsFromImages(imageFiles);

        // Save initial state
        saveInitialState();

        // Hide instructions
        tableInstructions.classList.add('hidden');

        setStatus(`Loaded ${imageFiles.length} cards. Ready to record!`, 'success');
        updateUI();

    } catch (error) {
        console.error('Error loading images:', error);
        setStatus('Error loading images: ' + error.message, 'error');
    }

    // Reset file input
    folderInput.value = '';
}

function createCardsFromImages(imageFiles) {
    const tableRect = cardArea.getBoundingClientRect();
    const cardWidth = 80;
    const cardHeight = 112;
    const padding = 60;

    // Calculate grid layout for initial card positions
    const cardsPerRow = Math.floor((tableRect.width - padding * 2) / (cardWidth + 15));
    const maxCards = Math.min(imageFiles.length, 52);

    for (let i = 0; i < maxCards; i++) {
        const file = imageFiles[i];
        const row = Math.floor(i / cardsPerRow);
        const col = i % cardsPerRow;

        const x = padding + col * (cardWidth + 15);
        const y = padding + row * (cardHeight + 15);

        const card = createCard(file, x, y, i);
        appState.cards.push(card);
    }
}

function createCard(fileInfo, x, y, index) {
    const cardId = `card-${index}-${fileInfo.baseName.replace(/\s+/g, '_')}`;

    // Create card element
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.id = cardId;
    cardEl.dataset.index = index;

    // Set initial position using transform
    cardEl.style.left = '0';
    cardEl.style.top = '0';
    cardEl.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;

    // Create image
    const img = document.createElement('img');
    if (fileInfo.path.startsWith('blob:') || fileInfo.path.startsWith('file://')) {
        img.src = fileInfo.path;
    } else {
        img.src = `file://${fileInfo.path}`;
    }
    img.alt = fileInfo.baseName;
    img.draggable = false;
    cardEl.appendChild(img);

    // Create label
    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = fileInfo.baseName;
    cardEl.appendChild(label);

    // Add to DOM
    cardArea.appendChild(cardEl);

    // Make draggable
    makeDraggable(cardEl);

    // Create card data object
    const cardData = {
        id: cardId,
        element: cardEl,
        name: fileInfo.baseName,
        path: fileInfo.path,
        x: x,
        y: y,
        rotation: 0,
        scale: 1,
        faceUp: true,
        flip: false,          // Action property
        slamEffect: false     // Action property
    };

    return cardData;
}

// ============================================
// DRAGGABLE FUNCTIONALITY
// ============================================

function makeDraggable(element) {
    let isDragging = false;
    let startMouseX, startMouseY;
    let startX, startY, rotation;

    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        e.stopPropagation();

        // Select this card
        const cardData = appState.cards.find(c => c.id === element.id);
        if (cardData) {
            selectCard(cardData);
        }

        isDragging = true;
        element.classList.add('dragging');

        // Get current transform values
        const transform = getTransformValues(element);
        startX = transform.x;
        startY = transform.y;
        rotation = transform.rotation;

        startMouseX = e.clientX;
        startMouseY = e.clientY;

        // Bring to front
        element.style.zIndex = 1000;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;

        // Calculate new position relative to game container
        const containerRect = gameContainer.getBoundingClientRect();
        const scaleX = PROJECT_INFO.width / containerRect.width;
        const scaleY = PROJECT_INFO.height / containerRect.height;

        const newX = startX + dx * scaleX;
        const newY = startY + dy * scaleY;

        // Apply transform
        element.style.transform = `translate(${newX}px, ${newY}px) rotate(${rotation}deg)`;

        // Update card data
        const cardData = appState.cards.find(c => c.id === element.id);
        if (cardData) {
            cardData.x = newX;
            cardData.y = newY;
            updateCardPropertiesUI(cardData);
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        element.style.zIndex = '';

        // Check if card has changed
        checkCardChanges();
        updateUI();
    });

    // Click to select
    element.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardData = appState.cards.find(c => c.id === element.id);
        if (cardData) {
            selectCard(cardData);
        }
    });
}

function getTransformValues(element) {
    const transform = element.style.transform;
    const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);

    return {
        x: translateMatch ? parseFloat(translateMatch[1]) : 0,
        y: translateMatch ? parseFloat(translateMatch[2]) : 0,
        rotation: rotateMatch ? parseFloat(rotateMatch[1]) : 0
    };
}

// ============================================
// CARD SELECTION
// ============================================

function selectCard(cardData) {
    // Deselect previous
    if (appState.selectedCard) {
        appState.selectedCard.element.classList.remove('selected');
    }

    // Select new
    appState.selectedCard = cardData;
    cardData.element.classList.add('selected');

    // Update UI
    noCardSelected.classList.add('hidden');
    cardProperties.classList.remove('hidden');
    selectedCardName.textContent = cardData.name;

    // Sync action properties
    flipCardCheck.checked = cardData.flip || false;
    slamEffectCheck.checked = cardData.slamEffect || false;

    updateCardPropertiesUI(cardData);
}

function deselectCard() {
    if (appState.selectedCard) {
        appState.selectedCard.element.classList.remove('selected');
        appState.selectedCard = null;
    }

    noCardSelected.classList.remove('hidden');
    cardProperties.classList.add('hidden');
}

function updateCardPropertiesUI(cardData) {
    cardPosX.textContent = Math.round(cardData.x);
    cardPosY.textContent = Math.round(cardData.y);
    cardRot.textContent = `${Math.round(cardData.rotation)}°`;
}

// ============================================
// ACTION PROPERTIES
// ============================================

function handleActionPropertyChange() {
    if (!appState.selectedCard) return;

    appState.selectedCard.flip = flipCardCheck.checked;
    appState.selectedCard.slamEffect = slamEffectCheck.checked;

    // Update visual indicators
    const el = appState.selectedCard.element;
    el.classList.toggle('flip-marked', appState.selectedCard.flip);
    el.classList.toggle('slam-marked', appState.selectedCard.slamEffect);

    checkCardChanges();
}

// ============================================
// POSE-TO-POSE RECORDING
// ============================================

function handleAddStep() {
    if (appState.isEditingStep) {
        setStatus('Please finish the current step first', 'error');
        return;
    }

    // Take snapshot of current state (Start State)
    startSnapshot = takeSnapshot();

    // Create new step
    const stepIndex = scenarioData.scenario.length + 1;
    currentStep = {
        stepId: stepIndex,
        duration: parseFloat(stepDuration.value) || 1.0,
        actions: []
    };

    appState.isEditingStep = true;
    appState.currentStepIndex = stepIndex;

    // Update UI
    finishStepBtn.disabled = false;
    addStepBtn.disabled = true;
    recordingIndicator.classList.add('active');
    currentStepNum.textContent = stepIndex;

    setStatus(`Editing Step ${stepIndex} - Drag cards and set properties, then click Finish Step`, 'recording');
    updateUI();
}

function handleFinishStep() {
    if (!appState.isEditingStep || !currentStep || !startSnapshot) {
        setStatus('No step is being edited', 'error');
        return;
    }

    // Compare current state with snapshot to find changes
    const endSnapshot = takeSnapshot();
    const actions = computeActions(startSnapshot, endSnapshot);

    // Update step with actions
    currentStep.duration = parseFloat(stepDuration.value) || 1.0;
    currentStep.actions = actions;

    // Add step to scenario
    scenarioData.scenario.push(currentStep);

    // Reset editing state
    appState.isEditingStep = false;
    currentStep = null;
    startSnapshot = null;

    // Reset card visual states
    appState.cards.forEach(card => {
        card.element.classList.remove('has-changes', 'flip-marked', 'slam-marked');
        card.flip = false;
        card.slamEffect = false;
    });

    // Update checkboxes if card is selected
    if (appState.selectedCard) {
        flipCardCheck.checked = false;
        slamEffectCheck.checked = false;
    }

    // Update UI
    finishStepBtn.disabled = true;
    addStepBtn.disabled = false;
    recordingIndicator.classList.remove('active');
    currentStepNum.textContent = '-';
    totalSteps.textContent = scenarioData.scenario.length;

    renderTimeline();

    setStatus(`Step ${scenarioData.scenario.length} saved with ${actions.length} action(s)`, 'success');
    updateUI();
}

function takeSnapshot() {
    const snapshot = {};
    appState.cards.forEach(card => {
        snapshot[card.id] = {
            x: card.x,
            y: card.y,
            rotation: card.rotation,
            scale: card.scale,
            faceUp: card.faceUp
        };
    });
    return snapshot;
}

function computeActions(startSnap, endSnap) {
    const actions = [];
    const POSITION_THRESHOLD = 1; // Minimum pixel change to register

    appState.cards.forEach(card => {
        const start = startSnap[card.id];
        const end = endSnap[card.id];

        if (!start || !end) return;

        // Check for position/rotation changes
        const posChanged = Math.abs(end.x - start.x) > POSITION_THRESHOLD ||
            Math.abs(end.y - start.y) > POSITION_THRESHOLD;
        const rotChanged = Math.abs(end.rotation - start.rotation) > 0.5;
        const hasFlip = card.flip;
        const hasSlam = card.slamEffect;

        if (posChanged || rotChanged || hasFlip || hasSlam) {
            const action = {
                targetId: card.id,
                type: 'TRANSFORM',
                endPosition: { x: Math.round(end.x), y: Math.round(end.y) },
                endRotation: Math.round(end.rotation),
                flip: hasFlip,
                effect: hasSlam ? 'SLAM' : null
            };

            // Include start position for delta calculation
            action.startPosition = { x: Math.round(start.x), y: Math.round(start.y) };
            action.startRotation = Math.round(start.rotation);

            actions.push(action);
        }
    });

    return actions;
}

function checkCardChanges() {
    if (!appState.isEditingStep || !startSnapshot) return;

    appState.cards.forEach(card => {
        const start = startSnapshot[card.id];
        if (!start) return;

        const posChanged = Math.abs(card.x - start.x) > 1 ||
            Math.abs(card.y - start.y) > 1;
        const hasAction = posChanged || card.flip || card.slamEffect;

        card.element.classList.toggle('has-changes', hasAction && !card.flip && !card.slamEffect);
    });

    updateUI();
}

// ============================================
// INITIAL STATE
// ============================================

function saveInitialState() {
    scenarioData.initialState = {};
    appState.cards.forEach(card => {
        scenarioData.initialState[card.id] = {
            name: card.name,
            path: card.path,
            x: Math.round(card.x),
            y: Math.round(card.y),
            rotation: card.rotation,
            scale: card.scale,
            faceUp: card.faceUp
        };
    });
}

// ============================================
// TIMELINE
// ============================================

function renderTimeline() {
    timelinePreview.innerHTML = '';

    scenarioData.scenario.forEach((step, index) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'timeline-step';
        if (step.actions.length > 0) {
            stepEl.classList.add('has-actions');
        }
        stepEl.textContent = step.stepId;
        stepEl.title = `Step ${step.stepId}: ${step.actions.length} action(s), ${step.duration}s`;

        stepEl.addEventListener('click', () => {
            // Could add step preview/edit functionality here
            console.log('Step clicked:', step);
        });

        timelinePreview.appendChild(stepEl);
    });
}

// ============================================
// EXPORT
// ============================================

function handleExportJSON() {
    if (scenarioData.scenario.length === 0) {
        setStatus('No steps recorded. Add steps first!', 'error');
        return;
    }

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

    setStatus('Scenario JSON exported successfully!', 'success');
}

function handleExportToAE() {
    if (!csInterface) {
        setStatus('After Effects not connected. Export JSON instead.', 'error');
        return;
    }

    if (scenarioData.scenario.length === 0) {
        setStatus('No steps recorded. Add steps first!', 'error');
        return;
    }

    // Validate assets path is selected
    if (!appState.assetsRootPath) {
        setStatus('❌ Please select Assets Folder first!', 'error');
        // Highlight the button
        selectAssetsFolderBtn.style.animation = 'pulse 0.5s ease-in-out 3';
        setTimeout(() => {
            selectAssetsFolderBtn.style.animation = '';
        }, 1500);
        return;
    }

    setStatus('Sending to After Effects...', 'recording');

    const jsonString = JSON.stringify(scenarioData);
    const assetsPath = escapeJsonForScript(appState.assetsRootPath);

    // Call generateSequence with both JSON data and assets root path
    csInterface.evalScript(
        `generateSequence('${escapeJsonForScript(jsonString)}', '${assetsPath}')`,
        function (result) {
            try {
                const response = JSON.parse(result);
                if (response.success) {
                    setStatus(`✓ Sent to AE: ${response.message}`, 'success');
                } else {
                    setStatus(`Export failed: ${response.message}`, 'error');
                }
            } catch (e) {
                if (result === 'EvalScript error.') {
                    setStatus('Error: Check After Effects ExtendScript', 'error');
                } else {
                    setStatus('Sent to After Effects', 'success');
                }
            }
        }
    );
}

function escapeJsonForScript(jsonString) {
    return jsonString
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// ============================================
// RESET
// ============================================

function handleReset() {
    if (scenarioData.scenario.length > 0) {
        if (!confirm('This will clear all recorded steps. Continue?')) {
            return;
        }
    }

    clearCards();
    scenarioData.scenario = [];
    scenarioData.initialState = {};
    appState.isEditingStep = false;
    currentStep = null;
    startSnapshot = null;

    tableInstructions.classList.remove('hidden');
    finishStepBtn.disabled = true;
    addStepBtn.disabled = false;
    recordingIndicator.classList.remove('active');
    currentStepNum.textContent = '-';
    totalSteps.textContent = '0';

    renderTimeline();
    deselectCard();

    setStatus('All cleared - Import a deck to start');
    updateUI();
}

function clearCards() {
    cardArea.innerHTML = '';
    appState.cards = [];
    appState.selectedCard = null;
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Update card count
    cardCountEl.textContent = `Cards: ${appState.cards.length}`;

    // Count total actions
    const totalActions = scenarioData.scenario.reduce((sum, step) => sum + step.actions.length, 0);
    actionCountEl.textContent = `Actions: ${totalActions}`;

    // Update total steps
    totalSteps.textContent = scenarioData.scenario.length;
}

function setStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-bar';
    if (type) {
        statusMessage.classList.add(type);
    }
}

// ============================================
// UTILITY
// ============================================

function getRelativePosition(element) {
    const containerRect = gameContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Calculate position relative to game container, scaled to reference dimensions
    const scaleX = PROJECT_INFO.width / containerRect.width;
    const scaleY = PROJECT_INFO.height / containerRect.height;

    return {
        x: (elementRect.left - containerRect.left) * scaleX,
        y: (elementRect.top - containerRect.top) * scaleY
    };
}
