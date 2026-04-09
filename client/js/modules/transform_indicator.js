/**
 * SVG Fan Transform Indicator Module
 * Renders an SVG overlay with cone/arc physics for grouping and fanning cards.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

let svgOverlay = null;       // Main SVG wrapper
let activePlaces = [];
let dragState = null;
let transData = null;        // Analyzed topological data for the current selection

function ensureSVGOverlay() {
    if (document.getElementById('transformIndicatorSvg')) {
        svgOverlay = document.getElementById('transformIndicatorSvg');
        return;
    }

    svgOverlay = document.createElementNS(SVG_NS, 'svg');
    svgOverlay.id = 'transformIndicatorSvg';
    svgOverlay.classList.add('hidden');
    // Styling defined in CSS

    gameContainer.appendChild(svgOverlay);
}

function showTransformIndicator(places) {
    if (!places || places.length < 2) {
        hideTransformIndicator();
        return;
    }
    
    activePlaces = places;
    ensureSVGOverlay();
    
    if (!dragState) {
        transData = analyzeLayers(places);
    }
    
    renderSVGIndicator();
    svgOverlay.classList.remove('hidden');
    document.body.classList.add('indicator-active');
}

function hideTransformIndicator() {
    if (svgOverlay) {
        svgOverlay.classList.add('hidden');
    }
    document.body.classList.remove('indicator-active');
    const confirmBtn = document.getElementById('indicatorConfirmBtn');
    if (confirmBtn) confirmBtn.style.display = 'none';
    activePlaces = [];
    transData = null;
    dragState = null;
}

/**
 * Parses selected places into structured geometry: Pivot, Layers (Rows), Spread Angle.
 */
function analyzeLayers(places) {
    // Determine bottom-center bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    places.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;
    
    // Default pivot (vertex of the V-cone) is below the lowest card
    const pivotX = centerX;
    let pivotY = maxY + 300; // Magic distance below the hand (Increased to 300 for gentler default arc)

    // Sort by Y to cluster into layers horizontally
    let sortedItems = places.map(p => ({
        p: p,
        d: Math.sqrt(Math.pow(p.x - pivotX, 2) + Math.pow(p.y - pivotY, 2)),
        angle: Math.atan2(p.x - pivotX, pivotY - p.y) // 0 is straight UP. positive is RIGHT.
    })).sort((a, b) => a.p.y - b.p.y);

    let layers = [];
    if (sortedItems.length > 0) {
        let currentLayer = [sortedItems[0]];
        for(let i = 1; i < sortedItems.length; i++) {
            // Group distances into distinct layers (strict threshold to avoid merging close rows)
            if (Math.abs(sortedItems[i].p.y - currentLayer[0].p.y) > 20) {
                layers.push(currentLayer);
                currentLayer = [sortedItems[i]];
            } else {
                currentLayer.push(sortedItems[i]);
            }
        }
        layers.push(currentLayer);
    }

    let totalGaps = 0;
    let totalGapDist = 0;

    let finalLayers = layers.map((layerItems) => {
        // Sort items inside layer by X (left to right) to prevent overlap bugs
        layerItems.sort((a, b) => a.p.x - b.p.x);

        for (let i = 1; i < layerItems.length; i++) {
            totalGaps++;
            totalGapDist += (layerItems[i].p.x - layerItems[i-1].p.x);
        }

        // For each layer, find the base radius (average distance to pivot)
        const avgR = layerItems.reduce((sum, item) => sum + item.d, 0) / layerItems.length;
        return {
            radius: avgR,
            originalRadius: avgR,
            items: layerItems.map((item, idx) => {
                return {
                    place: item.p,
                    originalLocalRotation: item.p.rotation || 0,
                    relativeIndex: idx - (layerItems.length - 1) / 2
                };
            })
        };
    });

    let initialSpacing = totalGaps > 0 ? (totalGapDist / totalGaps) : 60;

    // Build transData structure
    return {
        pivot: { x: pivotX, y: pivotY },
        originalPivot: { x: pivotX, y: pivotY },
        centroid: { x: centerX, y: centerY },
        baseRotation: 0, // Master rotation of the entire group around pivot
        centroidRotation: 0, // In-place rotation around centroid
        spacing: initialSpacing, // Uniform arc spacing parameter
        spread: {
            leftAngle: -0.15, // Will be auto-computed in applyMathToCards
            rightAngle: 0.15
        },
        layers: finalLayers
    };
}

/**
 * Renders the mathematical data into visual SVG DOM elements
 */
function renderSVGIndicator() {
    svgOverlay.innerHTML = ''; // Fast clears

    if (!transData) return;

    const { pivot, spread, layers, baseRotation } = transData;

    // We must map abstract (Card placement coords 1280x720) to physical DOM pixels
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) return;
    const tableRect = pokerTable.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();
    const scaleX = pokerTable.offsetWidth / UI_WIDTH;
    const scaleY = pokerTable.offsetHeight / UI_HEIGHT;
    const offsetX = tableRect.left - containerRect.left;
    const offsetY = tableRect.top - containerRect.top;

    const mapToDOM = (x, y) => ({
        x: x * scaleX + offsetX,
        y: y * scaleY + offsetY
    });

    const domPivot = mapToDOM(pivot.x, pivot.y);

    // 1. Draw Side V-Lines (Spread Guidelines)
    const drawSideLine = (angle, isRightHandle) => {
        // Calculate point far out
        const farRad = layers.length > 0 ? layers[layers.length - 1].radius + 200 : 800;
        // Apply baseRotation
        const finalAngle = angle + baseRotation;
        const domFar = mapToDOM(
            pivot.x + farRad * Math.sin(finalAngle),
            pivot.y - farRad * Math.cos(finalAngle)
        );

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', domPivot.x);
        line.setAttribute('y1', domPivot.y);
        line.setAttribute('x2', domFar.x);
        line.setAttribute('y2', domFar.y);
        line.setAttribute('class', 'guide-line');
        svgOverlay.appendChild(line);

        // Draw handle on this line roughly above the top layer
        const handleRad = (layers.length > 0 ? layers[layers.length - 1].radius : 400) + 50;
        const domHandle = mapToDOM(
            pivot.x + handleRad * Math.sin(finalAngle),
            pivot.y - handleRad * Math.cos(finalAngle)
        );
        createHandle(domHandle.x, domHandle.y, isRightHandle ? 'spread-right' : 'spread-left');
    };

    drawSideLine(spread.leftAngle, false);
    drawSideLine(spread.rightAngle, true);

    // 2. Draw Arc Guides per Layer
    layers.forEach((layer, idx) => {
        // Path command: M startX startY A rx ry x-axis-rotation large-arc-flag sweep-flag endX endY
        const finalLeftAngle = spread.leftAngle + baseRotation;
        const finalRightAngle = spread.rightAngle + baseRotation;
        
        const domStart = mapToDOM(
            pivot.x + layer.radius * Math.sin(finalLeftAngle),
            pivot.y - layer.radius * Math.cos(finalLeftAngle)
        );
        const domEnd = mapToDOM(
            pivot.x + layer.radius * Math.sin(finalRightAngle),
            pivot.y - layer.radius * Math.cos(finalRightAngle)
        );
        
        const path = document.createElementNS(SVG_NS, 'path');
        // SVG radii are mapped to dom coordinates
        let rX = layer.radius * scaleX;
        let rY = layer.radius * scaleY;
        
        path.setAttribute('d', `M ${domStart.x} ${domStart.y} A ${rX} ${rY} 0 0 1 ${domEnd.x} ${domEnd.y}`);
        path.setAttribute('class', 'guide-arc');
        svgOverlay.appendChild(path);

        // Arc Handle (Moved to FAR-LEFT side so it doesn't block cards)
        const handleAngle = finalLeftAngle - 0.2;
        const domHandle = mapToDOM(
            pivot.x + layer.radius * Math.sin(handleAngle),
            pivot.y - layer.radius * Math.cos(handleAngle)
        );
        createHandle(domHandle.x, domHandle.y, 'layer-radius', { layerIndex: idx });
    });

    // 3. Draw Centroid handle (Move tool at center of cards)
    const domCentroid = mapToDOM(transData.centroid.x, transData.centroid.y);
    createHandle(domCentroid.x, domCentroid.y, 'pivot'); // Reuse 'pivot' logic for translation

    // 4. Draw Rotate handle (Slightly above centroid)
    const domRotate = mapToDOM(transData.centroid.x, transData.centroid.y - 60);
    const rotLine = document.createElementNS(SVG_NS, 'line');
    rotLine.setAttribute('x1', domCentroid.x);
    rotLine.setAttribute('y1', domCentroid.y);
    rotLine.setAttribute('x2', domRotate.x);
    rotLine.setAttribute('y2', domRotate.y);
    rotLine.setAttribute('class', 'guide-line centroid-tool');
    svgOverlay.appendChild(rotLine);
    
    createHandle(domRotate.x, domRotate.y, 'rotate');

    // 5. Draw Floating Confirm Button (HTML layer)
    let confirmBtn = document.getElementById('indicatorConfirmBtn');
    if (!confirmBtn) {
        confirmBtn = document.createElement('button');
        confirmBtn.id = 'indicatorConfirmBtn';
        confirmBtn.innerHTML = '✔️ Chốt Thế Bài';
        confirmBtn.title = 'Confirm & Lock Layout';
        
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTransformIndicator();
            if (typeof appState !== 'undefined') {
                appState.selectedCardPlaces = [];
                if (typeof renderCardPlaceMarkers === 'function') renderCardPlaceMarkers();
            }
        });
        gameContainer.appendChild(confirmBtn);
    }
    
    // Position it slightly above the top-most card layer
    let topsY = Infinity;
    layers.forEach(l => l.items.forEach(i => {
        if (i.place.y < topsY) topsY = i.place.y;
    }));
    const domTop = mapToDOM(transData.centroid.x, topsY);
    
    confirmBtn.style.left = `${domTop.x}px`;
    confirmBtn.style.top = `${domTop.y - 80}px`; 
    confirmBtn.style.transform = 'translate(-50%, -50%)';
    confirmBtn.style.display = 'block';
}

/**
 * Helper to construct an SVG circle handle and attach events
 */
function createHandle(x, y, type, meta = {}) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', `svg-handle handle-${type}`);
    group.dataset.type = type;
    if (meta.layerIndex !== undefined) group.dataset.layerIndex = meta.layerIndex;

    const handle = document.createElementNS(SVG_NS, 'circle');
    handle.setAttribute('cx', x);
    handle.setAttribute('cy', y);
    handle.setAttribute('r', type === 'rotate' ? 12 : (type === 'pivot' ? 10 : 6));
    group.appendChild(handle);

    if (type === 'rotate') {
        const icon = document.createElementNS(SVG_NS, 'text');
        icon.setAttribute('x', x);
        icon.setAttribute('y', y + 1.5);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('dominant-baseline', 'central');
        icon.setAttribute('font-size', '15px');
        icon.setAttribute('fill', 'white');
        icon.textContent = '↻';
        icon.style.pointerEvents = 'none';
        group.appendChild(icon);
    } else if (type === 'pivot') {
        const icon = document.createElementNS(SVG_NS, 'path');
        icon.setAttribute('d', 'M 0 -6 L -2 -4 M 0 -6 L 2 -4 M 0 -6 L 0 6 M -2 4 L 0 6 L 2 4 M -6 0 L -4 -2 M -6 0 L -4 2 M -6 0 L 6 0 M 4 -2 L 6 0 L 4 2');
        icon.setAttribute('transform', `translate(${x}, ${y})`);
        icon.setAttribute('stroke', 'white');
        icon.setAttribute('stroke-width', '1.5');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.style.pointerEvents = 'none';
        group.appendChild(icon);
    }

    group.addEventListener('mousedown', (e) => startTransformDrag(e, type, meta));
    svgOverlay.appendChild(group);
}

// ----------------------------------------------------
// DRAG PHYSICS
// ----------------------------------------------------

function startTransformDrag(e, type, meta) {
    e.stopPropagation();
    e.preventDefault();
    if (activePlaces.length < 2 || !transData) return;

    if (typeof pushBoardUndoSnapshot === 'function') pushBoardUndoSnapshot();

    if (type === 'rotate') {
        transData.centroidRotation += Math.PI / 2; // Auto rotate +90 degrees instantly
        applyMathToCards();
        renderSVGIndicator();
        if (typeof renderCardPlaceMarkers === 'function') renderCardPlaceMarkers();
        if (typeof renderCardDropZones === 'function') renderCardDropZones();
        if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
        return; // Skip entering drag state
    }

    dragState = {
        type: type,
        meta: meta,
        startX: e.clientX,
        startY: e.clientY,
        startTransData: JSON.parse(JSON.stringify(transData)) // Deep copy of math skeleton
    };

    document.addEventListener('mousemove', onTransformDragMove);
    document.addEventListener('mouseup', endTransformDrag);
}

function onTransformDragMove(e) {
    if (!dragState) return;

    // Convert screen deltas to abstract scaled coordinates (1280x720 space)
    const pokerTable = document.getElementById('pokerTable');
    let scaleX = 1; let scaleY = 1;
    if (pokerTable) {
        scaleX = UI_WIDTH / pokerTable.offsetWidth;
        scaleY = UI_HEIGHT / pokerTable.offsetHeight;
    }

    const startXAlg = dragState.startX * scaleX;
    const startYAlg = dragState.startY * scaleY;
    const curXAlg = e.clientX * scaleX;
    const curYAlg = e.clientY * scaleY;
    
    const dX = curXAlg - startXAlg;
    const dY = curYAlg - startYAlg;

    // Math Pointers
    const initialData = dragState.startTransData;
    
    // --- MODE: PIVOT (TRANSLATE ALL) ---
    if (dragState.type === 'pivot') {
        transData.pivot.x = initialData.pivot.x + dX;
        transData.pivot.y = initialData.pivot.y + dY;
        transData.centroid.x = initialData.centroid.x + dX;
        transData.centroid.y = initialData.centroid.y + dY;
        applyMathToCards();
    }
    // --- MODE: LAYER RADIUS (Bending the layer out/in) ---
    else if (dragState.type === 'layer-radius') {
        const lIdx = dragState.meta.layerIndex;
        // Y displacement controls the radius (dragging "up" increases radius since pivot is below)
        // Mathematically, radius = sqrt((pivotX - curX)^2 + (pivotY - curY)^2)
        // Let's precisely map mouse dom -> abstract -> distance to pivot
        const domCx = e.clientX; 
        const domCy = e.clientY;
        const domPivotX = transData.pivot.x / scaleX; // Approx tracking
        const radiusDelta = -dY; // dragging up = radius growth
        
        let newR = initialData.layers[lIdx].radius + radiusDelta;
        if (newR < 10) newR = 10;
        transData.layers[lIdx].radius = newR;
        applyMathToCards();
    }
    // --- MODE: SPREAD (Angles) ---
    else if (dragState.type === 'spread-left' || dragState.type === 'spread-right') {
        // Delta X determines the uniform arc spacing
        const scaleFactor = dragState.type === 'spread-left' ? -1 : 1;
        const deltaSpacing = dX * scaleFactor * 0.8; // Transform sensitivity
        
        let newSpacing = initialData.spacing + deltaSpacing;
        if (newSpacing < 0) newSpacing = 0;
        
        transData.spacing = newSpacing;
        applyMathToCards();
    }

    renderSVGIndicator();
    if (typeof renderCardPlaceMarkers === 'function') renderCardPlaceMarkers();
    if (typeof renderCardDropZones === 'function') renderCardDropZones();
}

function applyMathToCards() {
    const { pivot, spacing, layers, baseRotation, centroid, centroidRotation } = transData;
    
    let leftMost = 0;
    let rightMost = 0;

    layers.forEach(layer => {
        layer.items.forEach(item => {
            const p = item.place;
            
            // "Từ giữa ra": uniform arc angle step based on spacing
            const angleStep = spacing / layer.radius;
            const rawAngle = item.relativeIndex * angleStep;
            
            if (rawAngle < leftMost) leftMost = rawAngle;
            if (rawAngle > rightMost) rightMost = rawAngle;

            const finalAngle = rawAngle + baseRotation;
            
            p.x = pivot.x + layer.radius * Math.sin(finalAngle);
            p.y = pivot.y - layer.radius * Math.cos(finalAngle);
            p.rotation = Math.round((finalAngle * 180) / Math.PI);
            
            // Apply Centroid In-Place Spin (Affine Transformation)
            if (centroidRotation !== 0) {
                const rx = p.x - centroid.x;
                const ry = p.y - centroid.y;
                const angleRad = centroidRotation;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);
                
                p.x = centroid.x + (rx * cosA - ry * sinA);
                p.y = centroid.y + (rx * sinA + ry * cosA);
                p.rotation = Math.round(p.rotation + (angleRad * 180 / Math.PI));
            }
        });
    });

    // Visually update the V-cone guides around the cards
    transData.spread.leftAngle = leftMost - 0.1;
    transData.spread.rightAngle = rightMost + 0.1;
}

function endTransformDrag(e) {
    if (!dragState) return;
    document.removeEventListener('mousemove', onTransformDragMove);
    document.removeEventListener('mouseup', endTransformDrag);
    dragState = null;
    
    if (typeof updateCardPlacesList === 'function') updateCardPlacesList();
}

function syncTransformIndicator() {
    if (typeof appState !== 'undefined' && appState.selectedCardPlaces) {
        if (appState.selectedCardPlaces.length > 1) {
            showTransformIndicator(appState.selectedCardPlaces);
        } else {
            hideTransformIndicator();
        }
    }
}

window.showTransformIndicator = showTransformIndicator;
window.hideTransformIndicator = hideTransformIndicator;
window.syncTransformIndicator = syncTransformIndicator;

// ----------------------------------------------------
// UI Toggles
// ----------------------------------------------------
document.body.classList.add('indicator-ctrl'); // Always show handlers by default
