/**
 * updater.js — OTA Client Update Module
 * 
 * Version check: fetches versions.json from GitHub Raw URL (no auth needed).
 * Bundle download: uses authFetch (from auth.js) for authenticated download.
 * Requires: CEP environment with --enable-nodejs
 */

// Current client version (matches versions.json in Autonim-Poker repo root)
const CLIENT_VERSION = '2.0.7.0';
const UPDATE_CHECK_INTERVAL = 3600000; // 1 hour
const JUST_UPDATED_KEY = 'poker_just_updated_version';

// GitHub Raw URL for version check (public repo, no auth needed)
// Cache TTL: ~5 min (GitHub Fastly CDN). After push, có thể delay ~5 phút.
const GITHUB_VERSIONS_URL = 'https://raw.githubusercontent.com/DuongPham112/Autonim-Poker/main/versions.json';

/**
 * Check if a newer client version is available.
 * Primary: fetch versions.json from GitHub Raw URL (no auth, fast).
 * Fallback: authFetch from server endpoint (if GitHub unreachable).
 * @returns {{ updateAvailable: boolean, serverVersion: string, changelog: string }}
 */
async function checkForUpdates() {
    console.log('[Updater] Checking for updates... (current: v' + CLIENT_VERSION + ')');

    let versions = null;
    let source = '';

    // --- Primary: GitHub Raw URL (no auth needed) ---
    try {
        console.log('[Updater] Trying GitHub Raw URL...');
        const ghResponse = await fetch(GITHUB_VERSIONS_URL, { cache: 'no-store' });
        if (ghResponse.ok) {
            versions = await ghResponse.json();
            source = 'github';
            console.log('[Updater] ✓ Got versions from GitHub');
        } else {
            console.warn('[Updater] GitHub returned ' + ghResponse.status);
        }
    } catch (ghErr) {
        console.warn('[Updater] GitHub fetch failed:', ghErr.message);
    }

    // --- Fallback: Server endpoint (needs auth) ---
    if (!versions) {
        try {
            console.log('[Updater] Falling back to server endpoint...');
            const srvResponse = await authFetch('/api/poker/check-version');
            if (srvResponse.ok) {
                versions = await srvResponse.json();
                source = 'server';
                console.log('[Updater] ✓ Got versions from server (fallback)');
            } else {
                throw new Error('Server returned ' + srvResponse.status);
            }
        } catch (srvErr) {
            console.warn('[Updater] Server fallback also failed:', srvErr.message);
            // Both sources failed — return error (NOT "up to date")
            return {
                updateAvailable: false,
                serverVersion: CLIENT_VERSION,
                currentVersion: CLIENT_VERSION,
                error: 'Cannot check for updates. Both GitHub and server unreachable.'
            };
        }
    }

    const serverVersion = versions.clientVersion || '0.0.0';
    const updateAvailable = compareVersions(serverVersion, CLIENT_VERSION) > 0;

    console.log('[Updater] Version: v' + serverVersion + ' (from ' + source + '), update: ' + updateAvailable);

    return {
        updateAvailable,
        serverVersion,
        currentVersion: CLIENT_VERSION,
        scriptVersion: versions.scriptVersion || '0.0.0',
        assetVersion: versions.assetVersion || '0.0.0',
        changelog: versions.changelog || ''
    };
}

/**
 * Compare two semver-like version strings
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return na - nb;
    }
    return 0;
}

/**
 * Download and apply client update
 * @returns {{ success: boolean, filesUpdated: number }}
 */
async function applyUpdate() {
    console.log('[Updater] Downloading client bundle...');

    // Show progress in UI
    updateStatusUI('downloading', 'Downloading update...');

    try {
        console.log('[Updater] Fetching /api/poker/client-bundle...');
        const response = await authFetch('/api/poker/client-bundle');
        console.log('[Updater] client-bundle response status:', response.status);

        if (!response.ok) {
            let errMsg = 'Server returned ' + response.status;
            try {
                const errBody = await response.json();
                errMsg = errBody.error || errMsg;
            } catch (_) { }
            throw new Error(errMsg);
        }

        console.log('[Updater] Parsing bundle JSON...');
        const bundle = await response.json();
        console.log('[Updater] Bundle received: ' + (bundle.files ? bundle.files.length : 0) + ' files, version: ' + bundle.version);

        if (!bundle.files || bundle.files.length === 0) {
            updateStatusUI('idle', 'No files to update');
            return { success: false, filesUpdated: 0, reason: 'empty_bundle' };
        }

        updateStatusUI('downloading', 'Installing ' + bundle.files.length + ' files...');

        // Get the extension directory using CEP API
        const csInterface = new CSInterface();
        const extensionDir = csInterface.getSystemPath(SystemPath.EXTENSION);
        console.log('[Updater] Extension dir:', extensionDir);

        // Write each file
        let filesUpdated = 0;
        let fileErrors = [];
        for (const file of bundle.files) {
            try {
                const targetPath = extensionDir + '/client/' + file.path.replace(/\//g, '/');

                // Ensure parent directory exists
                const parentDir = require('path').dirname(targetPath);
                mkdirRecursive(parentDir);

                // Decode base64 and write
                const content = Buffer.from(file.content, 'base64');
                require('fs').writeFileSync(targetPath, content);
                filesUpdated++;
                console.log('[Updater] ✓ Updated: ' + file.path + ' (' + file.size + ' bytes)');
            } catch (fileErr) {
                fileErrors.push(file.path);
                console.error('[Updater] ✗ Failed to write ' + file.path + ':', fileErr.message);
            }
        }

        // Store the new version and "just updated" flag
        localStorage.setItem('poker_client_version', bundle.version);
        localStorage.setItem(JUST_UPDATED_KEY, bundle.version);

        const msg = 'Updated to v' + bundle.version + '! (' + filesUpdated + '/' + bundle.files.length + ' files)';
        console.log('[Updater] ' + msg);
        if (fileErrors.length > 0) {
            console.warn('[Updater] Failed files:', fileErrors.join(', '));
        }

        updateStatusUI('success', msg + ' Restart to apply.');

        return { success: true, filesUpdated, version: bundle.version };
    } catch (error) {
        console.error('[Updater] Update failed:', error.message, error);
        updateStatusUI('error', 'Update failed: ' + error.message);
        return { success: false, filesUpdated: 0, error: error.message };
    }
}

/**
 * Recursively create directories (Node.js in CEP)
 */
function mkdirRecursive(dirPath) {
    const fs = require('fs');
    const path = require('path');

    if (fs.existsSync(dirPath)) return;

    const parent = path.dirname(dirPath);
    if (!fs.existsSync(parent)) {
        mkdirRecursive(parent);
    }
    fs.mkdirSync(dirPath);
}

/**
 * Update the status UI elements
 */
function updateStatusUI(state, message) {
    const statusEl = document.getElementById('update-status');
    const btnEl = document.getElementById('btn-check-update');

    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'update-status update-status--' + state;
    }

    if (btnEl) {
        btnEl.disabled = (state === 'downloading');
    }
}

/**
 * Initialize the update button and version display
 */
function initUpdaterUI() {
    const versionEl = document.getElementById('pluginVersion');
    const btnEl = document.getElementById('btn-check-update');

    if (versionEl) {
        versionEl.textContent = 'v' + CLIENT_VERSION;
    }

    // Check if we just updated on last boot — show success message
    const justUpdatedVersion = localStorage.getItem(JUST_UPDATED_KEY);
    if (justUpdatedVersion) {
        // Clear the flag so it only shows once
        localStorage.removeItem(JUST_UPDATED_KEY);
        console.log('[Updater] Just updated to v' + justUpdatedVersion + ', showing success');
        updateStatusUI('success', 'Updated to v' + justUpdatedVersion + ' ✓');
        // Auto-clear after 5 seconds
        setTimeout(() => updateStatusUI('idle', ''), 5000);
    }

    if (btnEl) {
        btnEl.addEventListener('click', async () => {
            btnEl.disabled = true;
            updateStatusUI('checking', 'Checking...');

            const result = await checkForUpdates();

            if (result.error) {
                // Show error only on manual check
                updateStatusUI('error', 'Check failed: ' + result.error);
                btnEl.disabled = false;
                return;
            }

            if (result.updateAvailable) {
                updateStatusUI('available', 'v' + result.serverVersion + ' available!');

                // Ask user to confirm
                if (confirm('Update available: v' + result.serverVersion + '\n\n' +
                    (result.changelog ? result.changelog + '\n\n' : '') +
                    'Download and install now? The panel will need to be restarted after update.')) {
                    const updateResult = await applyUpdate();
                    if (updateResult.success) {
                        if (confirm('Update installed! Restart the panel now to apply changes?')) {
                            // Reload the CEP panel
                            location.reload();
                        }
                    }
                } else {
                    updateStatusUI('idle', '');
                }
            } else {
                updateStatusUI('uptodate', 'Up to date ✓');
                setTimeout(() => updateStatusUI('idle', ''), 3000);
            }

            btnEl.disabled = false;
        });
    }
}

/**
 * Auto-check for updates on boot (non-blocking)
 * Does NOT show error if check fails — only shows badge if update available
 */
async function autoCheckUpdate() {
    // Skip auto-check if we just showed "just updated" message
    const justUpdatedVersion = localStorage.getItem(JUST_UPDATED_KEY);
    if (justUpdatedVersion) {
        console.log('[Updater] Skipping auto-check — just updated flag present');
        return;
    }

    try {
        const result = await checkForUpdates();
        if (result.updateAvailable) {
            updateStatusUI('available', 'Update v' + result.serverVersion + ' available!');
            // Show a subtle badge on the update button
            const btnEl = document.getElementById('btn-check-update');
            if (btnEl) {
                btnEl.classList.add('has-update');
            }
        }
        // If check failed or no update, stay silent — don't show error on boot
    } catch (e) {
        // Silent fail — don't disrupt the user on auto-check
        console.warn('[Updater] Auto-check silently failed:', e.message);
    }
}
