/**
 * Autonim-Poker - Main Application Logic
 * CEP Extension for After Effects
 * 
 * Features:
 * - Import card images from folder using Node.js fs/path
 * - Draggable cards on poker table
 * - Motion recording with Space + Drag
 * - Export keyframe data to After Effects
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

// CSInterface for AE communication
const csInterface = new CSInterface();

// Node.js modules (available in CEP with Node.js enabled)
const fs = require('fs');
const path = require('path');

// Application state
const appState = {
    cards: [],                    // Array of card objects
    selectedCard: null,           // Currently selected card
    isRecording: false,           // Is currently recording motion
    isSpacePressed: false,        // Is spacebar held down
    isDragging: false,            // Is currently dragging
    recordingInterval: null,      // Recording timer interval
    sequenceCounter: 1,           // Counter for composition names
    deckPath: null                // Path to imported deck folder
};

// Data structure for export to AE
const exportData = {
    compName: 'Poker_Sequence_01',
    frameRate: 30,
    layers: []
};

// Supported image formats
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
const RECORDING_INTERVAL_MS = 30; // Sample every 30ms

// ============================================
// DOM ELEMENTS
// ============================================

let importDeckBtn, resetBtn, exportBtn, folderInput;
let pokerTable, cardArea, tableInstructions;
let cardCountEl, keyframeCountEl, statusMessage;
let recordingIndicator;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

function init() {
    // Get DOM elements
    importDeckBtn = document.getElementById('importDeckBtn');
    resetBtn = document.getElementById('resetBtn');
    exportBtn = document.getElementById('exportBtn');
    folderInput = document.getElementById('folderInput');
    pokerTable = document.getElementById('pokerTable');
    cardArea = document.getElementById('cardArea');
    tableInstructions = document.getElementById('tableInstructions');
    cardCountEl = document.getElementById('cardCount');
    keyframeCountEl = document.getElementById('keyframeCount');
    statusMessage = document.getElementById('statusMessage');
    recordingIndicator = document.getElementById('recordingIndicator');

    // Bind event listeners
    bindEvents();

    // Update UI
    updateUI();

    console.log('Autonim-Poker initialized');
    setStatus('Ready - Import a deck to start');
}

function bindEvents() {
    // Button clicks
    importDeckBtn.addEventListener('click', () => folderInput.click());
    folderInput.addEventListener('change', handleFolderSelect);
    resetBtn.addEventListener('click', handleReset);
    exportBtn.addEventListener('click', handleExport);

    // Keyboard events for recording
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Prevent context menu on poker table
    pokerTable.addEventListener('contextmenu', e => e.preventDefault());
}

// ============================================
// FILE SYSTEM - IMPORT DECK
// ============================================

function handleFolderSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Get the folder path from first file
    const firstFile = files[0];
    const folderPath = path.dirname(firstFile.path);
    appState.deckPath = folderPath;

    setStatus(`Loading images from: ${path.basename(folderPath)}...`);

    // Read all image files from the folder
    try {
        const imageFiles = [];
        
        // Iterate through selected files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = path.extname(file.name).toLowerCase();
            
            if (SUPPORTED_FORMATS.includes(ext)) {
                imageFiles.push({
                    name: file.name,
                    path: file.path,
                    baseName: path.basename(file.name, ext)
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

        // Hide instructions
        tableInstructions.classList.add('hidden');

        setStatus(`Loaded ${imageFiles.length} cards from deck`, 'success');
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
    const padding = 20;
    
    // Calculate grid layout for initial card positions
    const cardsPerRow = Math.floor((tableRect.width - padding * 2) / (cardWidth + 10));
    
    imageFiles.forEach((file, index) => {
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;
        
        const x = padding + col * (cardWidth + 10);
        const y = padding + row * (cardHeight + 10);

        const card = createCard(file, x, y);
        appState.cards.push(card);
    });
}

function createCard(fileInfo, x, y) {
    const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create card element
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.id = cardId;
    cardEl.style.left = `${x}px`;
    cardEl.style.top = `${y}px`;
    cardEl.style.transform = 'rotate(0deg)';

    // Create image
    const img = document.createElement('img');
    img.src = `file://${fileInfo.path}`;
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

    // Bind drag events
    bindCardDragEvents(cardEl);

    // Create card data object
    const cardData = {
        id: cardId,
        element: cardEl,
        name: fileInfo.baseName,
        path: fileInfo.path,
        x: x,
        y: y,
        rotation: 0,
        keyframes: [],
        isRecording: false
    };

    return cardData;
}

// ============================================
// CARD DRAGGING
// ============================================

function bindCardDragEvents(cardEl) {
    let startX, startY, startLeft, startTop;
    let currentRotation = 0;

    cardEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click

        e.preventDefault();
        
        // Find card data
        const cardData = appState.cards.find(c => c.id === cardEl.id);
        if (!cardData) return;

        appState.selectedCard = cardData;
        appState.isDragging = true;

        // Get starting positions
        startX = e.clientX;
        startY = e.clientY;
        const rect = cardEl.getBoundingClientRect();
        const tableRect = cardArea.getBoundingClientRect();
        startLeft = rect.left - tableRect.left;
        startTop = rect.top - tableRect.top;
        currentRotation = cardData.rotation;

        // Add dragging class
        cardEl.classList.add('dragging');

        // Bring to front
        cardEl.style.zIndex = 1000;

        // Check if should start recording
        if (appState.isSpacePressed) {
            startRecording(cardData);
        }

        // Mouse move handler
        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            // Update position
            cardData.x = startLeft + dx;
            cardData.y = startTop + dy;

            // Calculate rotation based on movement velocity
            if (appState.isRecording) {
                const velocity = Math.sqrt(dx * dx + dy * dy);
                const rotationDelta = Math.atan2(dy, dx) * (180 / Math.PI);
                currentRotation = rotationDelta * 0.3; // Subtle rotation
                cardData.rotation = currentRotation;
            }

            // Apply transform
            cardEl.style.left = `${cardData.x}px`;
            cardEl.style.top = `${cardData.y}px`;
            cardEl.style.transform = `rotate(${cardData.rotation}deg)`;
        };

        // Mouse up handler
        const onMouseUp = () => {
            appState.isDragging = false;
            cardEl.classList.remove('dragging');
            cardEl.style.zIndex = '';

            // Stop recording if active
            if (cardData.isRecording) {
                stopRecording(cardData);
            }

            appState.selectedCard = null;

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            updateUI();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// ============================================
// RECORDING SYSTEM
// ============================================

function handleKeyDown(e) {
    if (e.code === 'Space' && !appState.isSpacePressed) {
        e.preventDefault();
        appState.isSpacePressed = true;

        // If already dragging, start recording
        if (appState.isDragging && appState.selectedCard) {
            startRecording(appState.selectedCard);
        }
    }
}

function handleKeyUp(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        appState.isSpacePressed = false;

        // Stop any active recording
        if (appState.selectedCard && appState.selectedCard.isRecording) {
            stopRecording(appState.selectedCard);
        }
    }
}

function startRecording(cardData) {
    if (cardData.isRecording) return;

    cardData.isRecording = true;
    appState.isRecording = true;

    // Clear previous keyframes for this card
    cardData.keyframes = [];
    cardData.recordStartTime = Date.now();

    // Add visual feedback
    cardData.element.classList.add('recording');
    recordingIndicator.classList.add('active');

    setStatus(`Recording motion for: ${cardData.name}`, 'recording');

    // Start sampling at 30ms intervals
    appState.recordingInterval = setInterval(() => {
        recordKeyframe(cardData);
    }, RECORDING_INTERVAL_MS);

    // Record first keyframe immediately
    recordKeyframe(cardData);

    console.log(`Started recording for card: ${cardData.name}`);
}

function stopRecording(cardData) {
    if (!cardData.isRecording) return;

    cardData.isRecording = false;
    appState.isRecording = false;

    // Stop sampling
    if (appState.recordingInterval) {
        clearInterval(appState.recordingInterval);
        appState.recordingInterval = null;
    }

    // Remove visual feedback
    cardData.element.classList.remove('recording');
    recordingIndicator.classList.remove('active');

    const keyframeCount = cardData.keyframes.length;
    setStatus(`Recorded ${keyframeCount} keyframes for: ${cardData.name}`, 'success');

    console.log(`Stopped recording for card: ${cardData.name}. Keyframes: ${keyframeCount}`);
    updateUI();
}

function recordKeyframe(cardData) {
    const time = (Date.now() - cardData.recordStartTime) / 1000; // Time in seconds

    const keyframe = {
        time: parseFloat(time.toFixed(3)),
        x: Math.round(cardData.x),
        y: Math.round(cardData.y),
        rotation: parseFloat(cardData.rotation.toFixed(2))
    };

    cardData.keyframes.push(keyframe);
    updateUI();
}

// ============================================
// EXPORT TO AFTER EFFECTS
// ============================================

function handleExport() {
    // Check if we have any cards with keyframes
    const cardsWithKeyframes = appState.cards.filter(c => c.keyframes.length > 0);

    if (cardsWithKeyframes.length === 0) {
        setStatus('No recorded motion to export. Hold SPACE + Drag cards first.', 'error');
        return;
    }

    // Build export data
    const exportPayload = {
        compName: `Poker_Sequence_${String(appState.sequenceCounter).padStart(2, '0')}`,
        frameRate: 30,
        tableWidth: cardArea.offsetWidth,
        tableHeight: cardArea.offsetHeight,
        layers: cardsWithKeyframes.map(card => ({
            name: card.name,
            path: card.path,
            keyframes: card.keyframes
        }))
    };

    setStatus('Exporting to After Effects...', 'recording');

    // Send to ExtendScript
    const jsonString = JSON.stringify(exportPayload);
    
    csInterface.evalScript(
        `importPokerAnimation('${escapeJsonForScript(jsonString)}')`,
        function(result) {
            try {
                const response = JSON.parse(result);
                if (response.success) {
                    setStatus(`✓ Exported to AE: ${exportPayload.compName}`, 'success');
                    appState.sequenceCounter++;
                    
                    // Clear keyframes after successful export
                    appState.cards.forEach(card => {
                        card.keyframes = [];
                    });
                    updateUI();
                } else {
                    setStatus(`Export failed: ${response.message}`, 'error');
                }
            } catch (e) {
                // If script didn't return JSON, check for eval error
                if (result === 'EvalScript error.') {
                    setStatus('Error: Check After Effects ExtendScript', 'error');
                } else {
                    setStatus('Export completed', 'success');
                    appState.sequenceCounter++;
                }
            }
        }
    );

    console.log('Export payload:', exportPayload);
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
    clearCards();
    appState.deckPath = null;
    appState.sequenceCounter = 1;
    tableInstructions.classList.remove('hidden');
    setStatus('Table cleared - Import a deck to start');
    updateUI();
}

function clearCards() {
    // Stop any recording
    if (appState.recordingInterval) {
        clearInterval(appState.recordingInterval);
        appState.recordingInterval = null;
    }

    // Remove all card elements
    cardArea.innerHTML = '';

    // Clear state
    appState.cards = [];
    appState.selectedCard = null;
    appState.isRecording = false;
    recordingIndicator.classList.remove('active');
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Update card count
    cardCountEl.textContent = `Cards: ${appState.cards.length}`;

    // Count total keyframes
    const totalKeyframes = appState.cards.reduce((sum, card) => sum + card.keyframes.length, 0);
    keyframeCountEl.textContent = `Keyframes: ${totalKeyframes}`;

    // Update export button state
    const hasKeyframes = appState.cards.some(c => c.keyframes.length > 0);
    exportBtn.disabled = !hasKeyframes;
}

function setStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-bar';
    if (type) {
        statusMessage.classList.add(type);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getSystemInfo() {
    const osInfo = csInterface.getOSInformation();
    const appInfo = csInterface.hostEnvironment;
    console.log('OS:', osInfo);
    console.log('Host App:', appInfo);
    return { os: osInfo, app: appInfo };
}
