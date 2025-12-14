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

    // Create Back Slot row
    const backRow = document.createElement('div');
    backRow.className = 'suit-row';
    backRow.innerHTML = `
        <div class="suit-label">Back</div>
        <div class="slots-container">
             <div class="card-slot" data-id="back" id="slot-back">
                <span class="upload-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </span>
                <span class="slot-label">back.png</span>
                <input type="file" id="file-back" style="display:none" accept="image/*">
             </div>
        </div>
    `;
    board.appendChild(backRow);

    // Setup back slot click
    const backSlot = backRow.querySelector('#slot-back');
    backSlot.onclick = (e) => {
        if (e.target.closest('.remove-btn')) return;
        document.getElementById('file-back').click();
    };
    backRow.querySelector('#file-back').onchange = (e) => {
        if (e.target.files.length > 0) fillSlot('back', null, e.target.files[0]);
    };

    // Create 4 suit rows
    SUITS.forEach(suit => {
        const row = document.createElement('div');
        row.className = 'suit-row';
        row.dataset.suit = suit;

        // Suit Icon
        let icon = '';
        if (suit === 'spades') icon = '♠';
        else if (suit === 'hearts') icon = '♥';
        else if (suit === 'diamonds') icon = '♦';
        else if (suit === 'clubs') icon = '♣';

        // Suit label with batch upload button
        const suitLabelDiv = document.createElement('div');
        suitLabelDiv.className = `suit-label ${suit}`;
        suitLabelDiv.innerHTML = `
            ${icon}
            <button class="batch-btn" title="Upload 13 cards (2→A)">📂</button>
            <input type="file" class="batch-input" style="display:none" accept="image/*" multiple>
        `;
        row.appendChild(suitLabelDiv);

        // Batch upload handler
        const batchBtn = suitLabelDiv.querySelector('.batch-btn');
        const batchInput = suitLabelDiv.querySelector('.batch-input');
        batchBtn.onclick = (e) => {
            e.stopPropagation();
            batchInput.click();
        };
        batchInput.onchange = (e) => handleBatchUpload(suit, e.target.files);

        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'slots-container';

        RANKS.forEach(rank => {
            const slot = document.createElement('div');
            slot.className = 'card-slot';
            slot.dataset.suit = suit;
            slot.dataset.rank = rank;
            slot.dataset.id = `${rank}_${suit}`;
            slot.id = `slot-${rank}_${suit}`;

            // Allow clicking to upload
            slot.onclick = (e) => {
                if (e.target.closest('.remove-btn')) return;
                document.getElementById(`file-${rank}_${suit}`).click();
            };

            slot.innerHTML = `
                <span class="upload-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </span>
                <span class="slot-label">${rank}</span>
                <input type="file" id="file-${rank}_${suit}" style="display:none" accept="image/*">
            `;

            const fileInput = slot.querySelector('input');
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    fillSlot(suit, rank, e.target.files[0]);
                }
            };

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

/**
 * Handle batch upload for a specific suit
 * Files are sorted by name and filled in sequence: 2, 3, 4, ..., 10, J, Q, K, A
 */
function handleBatchUpload(suit, files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // Sort files by name to ensure sequence
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    let filled = 0;
    for (let i = 0; i < imageFiles.length && i < RANKS.length; i++) {
        fillSlot(suit, RANKS[i], imageFiles[i]);
        filled++;
    }

    showStatus(`Filled ${filled} ${suit} cards`);
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
    e.stopPropagation();
    e.target.closest('.card-slot').classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fillSlot(suit, rank, files[0]);
    }
}

function handleMultiDrop(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    let fileIdx = 0;

    // Try to fill Back first if it's named 'back'
    const backFile = imageFiles.find(f => f.name.toLowerCase().includes('back'));
    if (backFile) {
        fillSlot('back', null, backFile);
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
        // Keep the input
        const existingInput = slot.querySelector('input');
        slot.innerHTML = '';
        if (existingInput) slot.appendChild(existingInput);

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
            // Restore initial state with input
            slot.innerHTML = `
                <span class="upload-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </span>
                <span class="slot-label">${suit === 'back' ? 'back' : rank}</span>
            `;
            if (existingInput) {
                existingInput.value = '';
                slot.appendChild(existingInput);
            }
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

    showStatus('Processing...');

    let processed = 0;
    const total = Object.keys(cardMap).length;

    for (const id in cardMap) {
        const file = cardMap[id];
        const fileName = (id === 'back') ? 'back.png' : `${id}.png`;
        const savePath = path.join(outFolder, fileName);

        try {
            const blob = await resizeImage(file, targetWidth);
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

function resizeImage(file, targetWidth) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratio = img.height / img.width;
            const targetHeight = Math.round(targetWidth * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

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
