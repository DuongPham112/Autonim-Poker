/**
 * Deck Prepper Logic
 * Handles drag-and-drop, resizing, and export
 */

// Global State
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
const cardMap = {}; // Maps "suit_rank" -> file object or blob

// Node.js fs
let fs, path;
try {
    fs = require('fs');
    path = require('path');
} catch (e) {
    console.warn('Node.js modules not found - browser mode');
}

document.addEventListener('DOMContentLoaded', init);

function init() {
    renderBoard();
    setupDragDrop();

    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('Clear all slots?')) {
            location.reload();
        }
    });
}

function renderBoard() {
    const board = document.getElementById('mainBoard');
    board.innerHTML = '';

    // Create Back Slot row first (optional, or just put it somewhere)
    // Actually, let's put Back at the top in a separate area if needed. 
    // For now, let's just do the 52 cards. 
    // Added Back card slot to header/separate

    const backRow = document.createElement('div');
    backRow.className = 'suit-row';
    backRow.innerHTML = `
        <div class="suit-label">Back</div>
        <div class="slots-container">
             <div class="card-slot" data-id="back" id="slot-back">
                <span class="slot-label">back.png</span>
             </div>
        </div>
    `;
    board.appendChild(backRow);

    // Create 4 suit rows
    SUITS.forEach(suit => {
        const row = document.createElement('div');
        row.className = 'suit-row';

        // Suit Icon
        let icon = '';
        if (suit === 'spades') icon = '♠';
        else if (suit === 'hearts') icon = '♥';
        else if (suit === 'diamonds') icon = '♦';
        else if (suit === 'clubs') icon = '♣';

        row.innerHTML = `<div class="suit-label ${suit}">${icon}</div>`;

        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'slots-container';

        RANKS.forEach(rank => {
            const slot = document.createElement('div');
            slot.className = 'card-slot';
            slot.dataset.suit = suit;
            slot.dataset.rank = rank;
            slot.dataset.id = `${rank}_${suit}`;
            slot.id = `slot-${rank}_${suit}`;

            slot.innerHTML = `<span class="slot-label">${rank}</span>`;

            // Allow individual drop
            slot.addEventListener('dragover', e => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });
            slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
            slot.addEventListener('drop', e => handleSlotDrop(e, suit, rank));

            slotsContainer.appendChild(slot);
        });

        row.appendChild(slotsContainer);
        board.appendChild(row);
    });
}

function setupDragDrop() {
    const overlay = document.getElementById('dropOverlay');

    window.addEventListener('dragenter', e => {
        overlay.style.display = 'flex';
    });

    overlay.addEventListener('dragleave', e => {
        if (e.target === overlay) overlay.style.display = 'none';
    });

    overlay.addEventListener('dragover', e => e.preventDefault());

    overlay.addEventListener('drop', e => {
        e.preventDefault();
        overlay.style.display = 'none';
        handleMultiDrop(e.dataTransfer.files);
    });
}

function handleSlotDrop(e, suit, rank) {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to window
    e.target.closest('.card-slot').classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fillSlot(suit, rank, files[0]);
    }
}

function handleMultiDrop(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    // Sort files by name to ensure sequence (optional but helpful)
    // imageFiles.sort((a, b) => a.name.localeCompare(b.name));

    // Logic: If dropped on a specific row, fill that row?
    // Current overlay is global. Let's ask user or imply logic.
    // IMPLICIT LOGIC: Fill empty slots starting from first empty suit?
    // OR: Just try to fill Spades -> Hearts -> Diamonds -> Clubs

    let fileIdx = 0;

    // Try to fill Back first if it's named 'back'
    const backFile = imageFiles.find(f => f.name.toLowerCase().includes('back'));
    if (backFile) {
        fillSlot('back', null, backFile);
        // Remove from list
        const idx = imageFiles.indexOf(backFile);
        if (idx > -1) imageFiles.splice(idx, 1);
    }

    // Iterate suits and ranks
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            if (fileIdx >= imageFiles.length) break;

            const id = `${rank}_${suit}`;
            if (!cardMap[id]) {
                fillSlot(suit, rank, imageFiles[fileIdx]);
                fileIdx++;
            }
        }
    }

    showStatus(`Filled ${fileIdx} slots from ${imageFiles.length} files`);
}

function fillSlot(suit, rank, file) {
    const id = suit === 'back' ? 'back' : `${rank}_${suit}`;

    // Store file
    cardMap[id] = file;

    // Update UI
    const slotId = suit === 'back' ? 'slot-back' : `slot-${rank}_${suit}`;
    const slot = document.getElementById(slotId);

    if (slot) {
        slot.innerHTML = ''; // Clear label
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        slot.appendChild(img);

        slot.classList.add('filled');

        // Add remove btn
        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            delete cardMap[id];
            slot.innerHTML = `<span class="slot-label">${suit === 'back' ? 'back' : rank}</span>`;
            slot.classList.remove('filled');
        };
        slot.appendChild(removeBtn);

        // Add name label on hover
        const nameLabel = document.createElement('span');
        nameLabel.className = 'slot-label';
        nameLabel.textContent = suit === 'back' ? 'back.png' : `${rank}_${suit}.png`;
        slot.appendChild(nameLabel);
    }
}

async function handleExport() {
    if (!fs) {
        alert('This feature requires Node.js context (CEP Extension). Browser download not implemented yet.');
        return;
    }

    // Select Output Folder
    const outResult = window.cep.fs.showOpenDialogEx(false, true, "Select Export Folder", "", []);
    if (outResult.err !== 0 || outResult.data.length === 0) return;

    const outFolder = outResult.data[0];
    const targetWidth = parseInt(document.getElementById('outWidth').value) || 400;
    const targetHeight = parseInt(document.getElementById('outHeight').value) || 560;

    showStatus('Processing...', 'loading');

    let processed = 0;
    const total = Object.keys(cardMap).length;

    for (const id in cardMap) {
        const file = cardMap[id];
        const fileName = (id === 'back') ? 'back.png' : `${id}.png`;
        const savePath = path.join(outFolder, fileName);

        try {
            const blob = await resizeImage(file, targetWidth, targetHeight);
            const buffer = await blobToBuffer(blob);
            fs.writeFileSync(savePath, buffer);
            processed++;
            showStatus(`Saved ${processed}/${total}: ${fileName}`);
        } catch (e) {
            console.error('Error saving ' + fileName, e);
        }
    }

    alert(`Done! Saved ${processed} cards to ${outFolder}`);
    showStatus('Ready');
}

function resizeImage(file, width, height) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Draw image scaled
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(blob => resolve(blob), 'image/png');
        };
        img.src = URL.createObjectURL(file);
    });
}

function blobToBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const buffer = Buffer.from(reader.result);
            resolve(buffer);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

function showStatus(msg) {
    document.getElementById('status').textContent = msg;
}
