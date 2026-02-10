/**
 * Script Loader Module — Autonim-Poker
 * Fetches obfuscated host/index.jsx from backend and injects into AE via evalScript
 */

// ============================================
// SCRIPT LOADING
// ============================================

const SCRIPT_VERSION_KEY = 'autonim_poker_script_version';

/**
 * Load core ExtendScript from backend and inject into AE
 * Uses authFetch from auth.js for authenticated requests
 */
async function loadCoreScript() {
    console.log('[ScriptLoader] Loading core script from backend...');

    try {
        const response = await authFetch('/api/poker/core-script');

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.script) {
            throw new Error('No script content received');
        }

        console.log(`[ScriptLoader] Received script v${data.version} (${data.script.length} chars)`);

        // Inject into After Effects via CSInterface
        const csInterface = typeof CSInterface !== 'undefined' ? new CSInterface() : null;

        if (csInterface) {
            return new Promise((resolve, reject) => {
                // evalScript can handle large strings — escape for safety
                const escapedScript = data.script
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r');

                csInterface.evalScript(escapedScript, (result) => {
                    if (result === 'EvalScript error.') {
                        console.error('[ScriptLoader] evalScript failed');
                        reject(new Error('Failed to inject script into AE'));
                        return;
                    }

                    // Verify injection by checking a known function
                    csInterface.evalScript('typeof generateSequence', (typeResult) => {
                        if (typeResult === 'function') {
                            console.log('[ScriptLoader] ✓ Core script injected and verified');
                            localStorage.setItem(SCRIPT_VERSION_KEY, data.version);
                            resolve({ version: data.version, verified: true });
                        } else {
                            console.warn('[ScriptLoader] ⚠ Script injected but generateSequence not found');
                            localStorage.setItem(SCRIPT_VERSION_KEY, data.version);
                            resolve({ version: data.version, verified: false });
                        }
                    });
                });
            });
        } else {
            // Browser/dev mode — no AE available
            console.warn('[ScriptLoader] CSInterface not available (dev mode). Script loaded but not injected.');
            localStorage.setItem(SCRIPT_VERSION_KEY, data.version);
            return { version: data.version, verified: false, devMode: true };
        }

    } catch (error) {
        console.error('[ScriptLoader] Failed to load core script:', error.message);

        // If auth error, re-throw to trigger login screen
        if (error.name === 'AuthError') throw error;

        // For network/other errors, try to continue with local fallback
        console.warn('[ScriptLoader] Will attempt to use locally cached script if available');
        throw error;
    }
}

/**
 * Get the current loaded script version
 */
function getLoadedScriptVersion() {
    return localStorage.getItem(SCRIPT_VERSION_KEY);
}
