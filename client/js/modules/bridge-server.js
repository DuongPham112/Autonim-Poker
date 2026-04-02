/**
 * Bridge Server — Local HTTP server for Claude Code ↔ CEP Panel communication
 *
 * Runs inside CEP (Node.js enabled) on localhost:3847
 * Receives scenario data from Claude Code skill, applies to board automatically
 *
 * Endpoints:
 *   GET  /api/status         — Board state, loaded deck, available slots
 *   GET  /api/presets        — List available preset layouts
 *   POST /api/load-preset    — Switch board layout
 *   POST /api/load-setup     — Place cards on board (no animation steps)
 *   POST /api/load-scenario  — Full scenario with initial setup + animation steps
 *   POST /api/export-ae      — Trigger export to After Effects
 */

(function () {
    'use strict';

    const BRIDGE_PORT = 3847;
    let server = null;
    let isRunning = false;

    // Check if we have Node.js (CEP environment)
    function hasNodeJS() {
        try {
            return typeof require === 'function' && typeof process !== 'undefined';
        } catch (e) {
            return false;
        }
    }

    /**
     * Start the bridge HTTP server
     */
    function startBridgeServer() {
        if (!hasNodeJS()) {
            console.warn('[Bridge] Node.js not available — bridge server disabled');
            updateBridgeIndicator(false);
            return;
        }

        if (isRunning) {
            console.log('[Bridge] Server already running on port ' + BRIDGE_PORT);
            return;
        }

        try {
            const http = require('http');

            server = http.createServer(function (req, res) {
                // CORS headers — localhost only
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                res.setHeader('Content-Type', 'application/json');

                // Handle preflight
                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                const url = req.url.split('?')[0]; // Strip query params
                console.log('[Bridge] ' + req.method + ' ' + url);

                // Route handling
                if (req.method === 'GET' && url === '/api/status') {
                    handleStatus(req, res);
                } else if (req.method === 'GET' && url === '/api/presets') {
                    handleGetPresets(req, res);
                } else if (req.method === 'POST' && url === '/api/load-preset') {
                    parseBody(req, function (body) { handleLoadPreset(body, res); });
                } else if (req.method === 'POST' && url === '/api/load-setup') {
                    parseBody(req, function (body) { handleLoadSetup(body, res); });
                } else if (req.method === 'POST' && url === '/api/load-scenario') {
                    parseBody(req, function (body) { handleLoadScenario(body, res); });
                } else if (req.method === 'POST' && url === '/api/export-ae') {
                    parseBody(req, function (body) { handleExportAE(body, res); });
                } else {
                    sendJSON(res, 404, { error: 'Not found', endpoints: ['/api/status', '/api/presets', '/api/load-preset', '/api/load-setup', '/api/load-scenario', '/api/export-ae'] });
                }
            });

            server.listen(BRIDGE_PORT, '127.0.0.1', function () {
                isRunning = true;
                console.log('[Bridge] Server listening on http://127.0.0.1:' + BRIDGE_PORT);
                updateBridgeIndicator(true);
            });

            server.on('error', function (err) {
                if (err.code === 'EADDRINUSE') {
                    console.warn('[Bridge] Port ' + BRIDGE_PORT + ' already in use. Trying port ' + (BRIDGE_PORT + 1));
                    server.listen(BRIDGE_PORT + 1, '127.0.0.1');
                } else {
                    console.error('[Bridge] Server error:', err.message);
                    updateBridgeIndicator(false);
                }
            });

        } catch (e) {
            console.error('[Bridge] Failed to start server:', e.message);
            updateBridgeIndicator(false);
        }
    }

    /**
     * Stop the bridge server
     */
    function stopBridgeServer() {
        if (server) {
            server.close();
            server = null;
            isRunning = false;
            console.log('[Bridge] Server stopped');
            updateBridgeIndicator(false);
        }
    }

    // ============================================
    // ROUTE HANDLERS
    // ============================================

    /**
     * GET /api/status — Return current board state
     */
    function handleStatus(req, res) {
        var state = typeof appState !== 'undefined' ? appState : {};
        var layout = state.boardLayout || {};
        var trayCards = (state.trayCards || []).filter(function (c) { return c.inTray !== false; });
        var tableCards = state.tableCards || [];
        var slots = layout.cardPlaces || [];

        var emptySlots = slots.filter(function (s) {
            return !tableCards.some(function (tc) { return tc.zone === 'grid-' + s.id; });
        });

        sendJSON(res, 200, {
            bridge: 'Autonim-Poker Bridge v1.0',
            port: BRIDGE_PORT,
            boardLoaded: !!layout.name,
            boardName: layout.name || null,
            boardStyle: layout.boardStyle || layout.type || null,
            totalSlots: slots.length,
            emptySlots: emptySlots.length,
            filledSlots: slots.length - emptySlots.length,
            availableCards: trayCards.length,
            cardsOnTable: tableCards.length,
            deckLoaded: trayCards.length > 0 || tableCards.length > 0,
            phase: state.currentPhase || 'unknown',
            slotIds: slots.map(function (s) { return s.id; }),
            availableCardNames: trayCards.map(function (c) { return c.name; })
        });
    }

    /**
     * GET /api/presets — List available presets
     */
    function handleGetPresets(req, res) {
        var presetSelect = document.getElementById('presetSelect');
        var presets = [];
        if (presetSelect) {
            for (var i = 0; i < presetSelect.options.length; i++) {
                var opt = presetSelect.options[i];
                presets.push({ value: opt.value, label: opt.textContent });
            }
        }
        sendJSON(res, 200, { presets: presets });
    }

    /**
     * POST /api/load-preset — Switch board layout
     * Body: { "preset": "pusoy" }
     */
    function handleLoadPreset(body, res) {
        if (!body || !body.preset) {
            return sendJSON(res, 400, { error: 'Missing "preset" field' });
        }

        try {
            var psEl = document.getElementById('presetSelect');
            if (psEl) {
                psEl.value = body.preset;
                if (typeof handleLoadPreset === 'function') {
                    window.handleLoadPreset(); // Call the app's preset loader
                }
            }
            sendJSON(res, 200, { success: true, preset: body.preset });
        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }
    }

    /**
     * POST /api/load-setup — Place cards on board (no animation steps)
     * Body: { "preset": "pusoy", "cards": [{"card": "ace_spades", "slot": "place-0", "faceUp": true}] }
     */
    function handleLoadSetup(body, res) {
        if (!body || !body.cards || !Array.isArray(body.cards)) {
            return sendJSON(res, 400, { error: 'Missing "cards" array' });
        }

        try {
            // Optionally switch preset
            if (body.preset && body.preset !== 'current') {
                var psEl = document.getElementById('presetSelect');
                if (psEl) {
                    psEl.value = body.preset;
                    if (typeof window.handleLoadPreset === 'function') {
                        window.handleLoadPreset();
                    }
                }
            }

            // Reset table
            if (typeof handleResetTable === 'function') {
                handleResetTable();
            }

            // Place cards
            var placed = 0;
            var errors = [];
            var trayAvailable = (appState.trayCards || []).filter(function (c) { return c.inTray !== false; });

            appState._bulkApplying = true;

            for (var i = 0; i < body.cards.length; i++) {
                var entry = body.cards[i];
                var card = typeof resolveCardName === 'function'
                    ? resolveCardName(entry.card, trayAvailable)
                    : trayAvailable.find(function (c) { return c.name === entry.card; });

                if (!card) {
                    errors.push('Card not found: ' + entry.card);
                    continue;
                }

                var slotId = entry.slot;
                var place = (appState.boardLayout.cardPlaces || []).find(function (p) { return p.id === slotId; });
                if (!place) {
                    errors.push('Slot not found: ' + slotId);
                    continue;
                }

                var zoneName = 'grid-' + slotId;
                var zoneElement = document.querySelector('.card-drop-zone[data-zone="' + zoneName + '"]');
                if (zoneElement) {
                    card.isFaceUp = entry.faceUp !== false;
                    placeCardInZone(card, zoneName, place.rotation || 0, zoneElement);
                    placed++;
                    // Remove from available pool
                    trayAvailable = trayAvailable.filter(function (c) { return c !== card; });
                } else {
                    errors.push('Zone element not found: ' + zoneName);
                }
            }

            appState._bulkApplying = false;

            if (typeof renderCardTray === 'function') renderCardTray();
            if (typeof updateUI === 'function') updateUI();

            sendJSON(res, 200, {
                success: true,
                placed: placed,
                errors: errors,
                total: body.cards.length
            });

        } catch (e) {
            appState._bulkApplying = false;
            sendJSON(res, 500, { error: e.message });
        }
    }

    /**
     * POST /api/load-scenario — Full scenario with setup + animation steps
     * Reuses the existing applyAIScenario() pipeline
     */
    function handleLoadScenario(body, res) {
        if (!body) {
            return sendJSON(res, 400, { error: 'Empty body' });
        }

        if (!body.initialSetup && !body.steps) {
            return sendJSON(res, 400, { error: 'Need at least "initialSetup" or "steps"' });
        }

        try {
            // Build result object matching applyAIScenario format
            var result = {
                preset: body.preset || 'current',
                initialSetup: body.initialSetup || [],
                steps: body.steps || [],
                reasoning: body.reasoning || 'Loaded via Claude Bridge'
            };

            // Apply scenario using existing pipeline
            if (typeof applyAIScenario === 'function') {
                applyAIScenario(result).then(function () {
                    sendJSON(res, 200, {
                        success: true,
                        setupCount: result.initialSetup.length,
                        stepCount: result.steps.length,
                        message: 'Scenario applied successfully'
                    });
                }).catch(function (err) {
                    sendJSON(res, 500, { error: 'Scenario apply failed: ' + err.message });
                });
            } else {
                sendJSON(res, 500, { error: 'applyAIScenario function not available' });
            }

        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }
    }

    /**
     * POST /api/export-ae — Trigger export to After Effects
     */
    function handleExportAE(body, res) {
        try {
            if (typeof handleExportToAE === 'function') {
                handleExportToAE();
                sendJSON(res, 200, { success: true, message: 'Export triggered' });
            } else {
                sendJSON(res, 500, { error: 'handleExportToAE function not available' });
            }
        } catch (e) {
            sendJSON(res, 500, { error: e.message });
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    function parseBody(req, callback) {
        var body = '';
        req.on('data', function (chunk) { body += chunk; });
        req.on('end', function () {
            try {
                callback(body ? JSON.parse(body) : null);
            } catch (e) {
                console.error('[Bridge] JSON parse error:', e.message);
                callback(null);
            }
        });
    }

    function sendJSON(res, status, data) {
        res.writeHead(status);
        res.end(JSON.stringify(data, null, 2));
    }

    function updateBridgeIndicator(active) {
        var indicator = document.getElementById('bridgeIndicator');
        if (indicator) {
            indicator.classList.toggle('active', active);
            indicator.title = active
                ? 'Claude Bridge: listening on port ' + BRIDGE_PORT
                : 'Claude Bridge: offline';
        }
    }

    // ============================================
    // EXPORTS
    // ============================================

    window.startBridgeServer = startBridgeServer;
    window.stopBridgeServer = stopBridgeServer;
    window.isBridgeRunning = function () { return isRunning; };

})();
