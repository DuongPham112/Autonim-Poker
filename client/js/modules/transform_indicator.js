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
    // 1. Detect if it's a linear layout
    let isLinear = false;
    let baseRotation = places[0].rotation || 0;

    // Check strict Group ID to prevent linear Arrays from showing radial arcs
    if (typeof appState !== 'undefined' && appState.boardLayout && appState.boardLayout.slotGroups) {
        const firstId = places[0].id;
        const group = appState.boardLayout.slotGroups.find(g => g.slotIds && g.slotIds.includes(firstId));
        if (group && group.id) {
            if (group.id.startsWith('array-')) isLinear = true;
            else if (group.id.startsWith('pusoy-')) isLinear = false;
            else isLinear = places.every(p => Math.abs((p.rotation || 0) - baseRotation) < 1);
        } else {
            isLinear = places.every(p => Math.abs((p.rotation || 0) - baseRotation) < 1);
        }
    } else {
        isLinear = places.every(p => Math.abs((p.rotation || 0) - baseRotation) < 1);
    }

    if (!isLinear) {
        // For spread/radial hands, using the first card's rotation skews the entire bounding box / arc.
        // The mean rotation across all symmetrically spread cards equates perfectly to the true orientation.
        baseRotation = places.reduce((sum, p) => sum + (p.rotation || 0), 0) / places.length;
    }

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

    if (isLinear) {
        let rad = baseRotation * Math.PI / 180;
        let dx = Math.cos(rad);
        let dy = Math.sin(rad);

        let itemsProj = places.map(p => {
            let proj = (p.x - centerX) * dx + (p.y - centerY) * dy;
            return {
                place: p,
                proj: proj,
                originalLocalRotation: p.rotation || 0
            };
        }).sort((a,b) => a.proj - b.proj);

        let totalSpacing = 0;
        if (itemsProj.length > 1) {
            totalSpacing = itemsProj[itemsProj.length - 1].proj - itemsProj[0].proj;
        }
        let spacing = itemsProj.length > 1 ? totalSpacing / (itemsProj.length - 1) : 60;

        itemsProj.forEach((item, idx) => {
            item.relativeIndex = idx - (itemsProj.length - 1) / 2;
        });

        return {
            type: 'linear',
            centroid: { x: centerX, y: centerY },
            baseRotation: baseRotation,
            centroidRotation: 0,
            spacing: spacing,
            items: itemsProj
        };
    }
    
    const baseRad = baseRotation * Math.PI / 180;
    const cosR = Math.cos(-baseRad);
    const sinR = Math.sin(-baseRad);

    // Map to Local Space to find the true Arc properties (Pivot, Layers)
    let localPlaces = places.map(p => {
        // Move relative to centroid
        let dx = p.x - centerX;
        let dy = p.y - centerY;
        // Rotate by -baseRotation
        let localX = dx * cosR - dy * sinR;
        let localY = dx * sinR + dy * cosR;
        return { p: p, lx: localX, ly: localY };
    });

    let localMinY = Infinity, localMaxY = -Infinity;
    localPlaces.forEach(lp => {
        if (lp.ly < localMinY) localMinY = lp.ly;
        if (lp.ly > localMaxY) localMaxY = lp.ly;
    });

    // In this local space (facing UP), the pivot is below the cards
    // The centroid in local space is (0, 0)!
    const localPivotX = 0;
    const localPivotY = localMaxY + 300; // 300 pixels "below" in local orientation

    // Convert local pivot back to global space
    const pivotX = centerX + (localPivotX * Math.cos(baseRad) - localPivotY * Math.sin(baseRad));
    const pivotY = centerY + (localPivotX * Math.sin(baseRad) + localPivotY * Math.cos(baseRad));

    // Sort by local Y (to cluster into layers naturally, since local space is facing UP)
    let sortedItems = localPlaces.map(lp => ({
        p: lp.p,
        d: Math.sqrt(Math.pow(lp.lx - localPivotX, 2) + Math.pow(lp.ly - localPivotY, 2)),
        // Angle in local space relative to pivot (0 is straight UP, positive is RIGHT)
        angle: Math.atan2(lp.lx - localPivotX, localPivotY - lp.ly),
        lx: lp.lx,
        ly: lp.ly
    })).sort((a, b) => a.ly - b.ly);

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
        // Sort items inside layer by local X (left to right from the hand's perspective)
        layerItems.sort((a, b) => a.lx - b.lx);

        for (let i = 1; i < layerItems.length; i++) {
            totalGaps++;
            totalGapDist += (layerItems[i].lx - layerItems[i-1].lx);
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

    let initialSpacing = 60; // FIX: Hardcode to avoid horizontal squeeze collapse

    // Build transData structure
    return {
        pivot: { x: pivotX, y: pivotY },
        originalPivot: { x: pivotX, y: pivotY },
        centroid: { x: centerX, y: centerY },
        baseRotation: baseRad, // Master rotation of the entire group around pivot (in radians)
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
    if (transData.type === 'linear') {
        const domCentroid = mapToDOM(transData.centroid.x, transData.centroid.y);
        const rad = transData.baseRotation * Math.PI / 180 + transData.centroidRotation;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);

        const limitProj = transData.items.length > 1 ? (transData.items.length - 1)/2 * transData.spacing + 50 : 200;

        const domStart = mapToDOM(transData.centroid.x - dx * limitProj, transData.centroid.y - dy * limitProj);
        const domEnd = mapToDOM(transData.centroid.x + dx * limitProj, transData.centroid.y + dy * limitProj);

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', domStart.x);
        line.setAttribute('y1', domStart.y);
        line.setAttribute('x2', domEnd.x);
        line.setAttribute('y2', domEnd.y);
        line.setAttribute('class', 'guide-line');
        line.setAttribute('stroke-dasharray', '5,5');
        svgOverlay.appendChild(line);

        createHandle(domStart.x, domStart.y, 'linear-shrink');
        createHandle(domEnd.x, domEnd.y, 'linear-expand');
        
        createHandle(domCentroid.x, domCentroid.y, 'pivot');

        const up_dx = Math.cos(rad - Math.PI/2);
        const up_dy = Math.sin(rad - Math.PI/2);
        const side_dx = Math.cos(rad);
        const side_dy = Math.sin(rad);

        const crossCenterX = transData.centroid.x + up_dx * 60;
        const crossCenterY = transData.centroid.y + up_dy * 60;
        const domCrossCenter = mapToDOM(crossCenterX, crossCenterY);
        const domRotRight = mapToDOM(crossCenterX + side_dx * 25, crossCenterY + side_dy * 25);
        const domRotLeft = mapToDOM(crossCenterX - side_dx * 25, crossCenterY - side_dy * 25);

        const rotLine = document.createElementNS(SVG_NS, 'line');
        rotLine.setAttribute('x1', domCentroid.x);
        rotLine.setAttribute('y1', domCentroid.y);
        rotLine.setAttribute('x2', domCrossCenter.x);
        rotLine.setAttribute('y2', domCrossCenter.y);
        rotLine.setAttribute('class', 'guide-line centroid-tool');
        svgOverlay.appendChild(rotLine);

        const rotCrossLine = document.createElementNS(SVG_NS, 'line');
        rotCrossLine.setAttribute('x1', domRotLeft.x);
        rotCrossLine.setAttribute('y1', domRotLeft.y);
        rotCrossLine.setAttribute('x2', domRotRight.x);
        rotCrossLine.setAttribute('y2', domRotRight.y);
        rotCrossLine.setAttribute('class', 'guide-line centroid-tool');
        svgOverlay.appendChild(rotCrossLine);
        
        createHandle(domRotLeft.x, domRotLeft.y, 'rotate-left');
        createHandle(domRotRight.x, domRotRight.y, 'rotate-right');

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
        
        const domTop = mapToDOM(transData.centroid.x, transData.centroid.y - 120);
        confirmBtn.style.left = `${domTop.x}px`;
        confirmBtn.style.top = `${domTop.y}px`; 
        confirmBtn.style.transform = 'translate(-50%, -50%)';
        confirmBtn.style.display = 'block';
        return;
    }

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

    // 4. Draw Rotate handles (Slightly above centroid)
    const domCrossCenter = mapToDOM(transData.centroid.x, transData.centroid.y - 60);
    const domRotLeft = mapToDOM(transData.centroid.x - 25, transData.centroid.y - 60);
    const domRotRight = mapToDOM(transData.centroid.x + 25, transData.centroid.y - 60);

    const rotLine = document.createElementNS(SVG_NS, 'line');
    rotLine.setAttribute('x1', domCentroid.x);
    rotLine.setAttribute('y1', domCentroid.y);
    rotLine.setAttribute('x2', domCrossCenter.x);
    rotLine.setAttribute('y2', domCrossCenter.y);
    rotLine.setAttribute('class', 'guide-line centroid-tool');
    svgOverlay.appendChild(rotLine);

    const rotCrossLine = document.createElementNS(SVG_NS, 'line');
    rotCrossLine.setAttribute('x1', domRotLeft.x);
    rotCrossLine.setAttribute('y1', domRotLeft.y);
    rotCrossLine.setAttribute('x2', domRotRight.x);
    rotCrossLine.setAttribute('y2', domRotRight.y);
    rotCrossLine.setAttribute('class', 'guide-line centroid-tool');
    svgOverlay.appendChild(rotCrossLine);
    
    createHandle(domRotLeft.x, domRotLeft.y, 'rotate-left');
    createHandle(domRotRight.x, domRotRight.y, 'rotate-right');

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
    handle.setAttribute('r', type.startsWith('rotate') ? 12 : (type === 'pivot' ? 10 : 6));
    group.appendChild(handle);

    if (type.startsWith('rotate')) {
        const icon = document.createElementNS(SVG_NS, 'text');
        icon.setAttribute('x', x);
        icon.setAttribute('y', y + 1.5);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('dominant-baseline', 'central');
        icon.setAttribute('font-size', '15px');
        icon.setAttribute('fill', 'white');
        icon.textContent = type === 'rotate-left' ? '↺' : '↻';
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

    if (type.startsWith('rotate')) {
        const angleDelta = type === 'rotate-right' ? Math.PI / 2 : -Math.PI / 2;
        transData.centroidRotation += angleDelta;
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
        if (transData.pivot) {
            transData.pivot.x = initialData.pivot.x + dX;
            transData.pivot.y = initialData.pivot.y + dY;
        }
        transData.centroid.x = initialData.centroid.x + dX;
        transData.centroid.y = initialData.centroid.y + dY;
        applyMathToCards();
    }
    // --- MODE: LINEAR STRETCH ---
    else if (dragState.type === 'linear-shrink' || dragState.type === 'linear-expand') {
        const rad = initialData.baseRotation * Math.PI / 180 + initialData.centroidRotation;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        
        const proj = dX * dx + dY * dy;
        const scaleFactor = dragState.type === 'linear-expand' ? 1 : -1;
        
        const N = initialData.items.length;
        const coeff = N > 1 ? 2 / (N - 1) : 1;
        const deltaSpacing = proj * scaleFactor * coeff;
        
        let newSpacing = initialData.spacing + deltaSpacing;
        if (newSpacing < 0) newSpacing = 0;
        
        transData.spacing = newSpacing;
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
    if (transData.type === 'linear') {
        const { centroid, spacing, baseRotation, centroidRotation, items } = transData;
        const rad = baseRotation * Math.PI / 180 + centroidRotation;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);

        items.forEach(item => {
            const p = item.place;
            p.x = centroid.x + item.relativeIndex * spacing * dx;
            p.y = centroid.y + item.relativeIndex * spacing * dy;
            p.rotation = Math.round(baseRotation + (centroidRotation * 180 / Math.PI));
        });
        return;
    }

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
