/**
 * updater.js — OTA Client Update Module
 * 
 * Checks server for newer client version, downloads updated files,
 * writes them to the extension directory using Node.js fs.
 * Requires: authFetch (from auth.js), CEP environment with --enable-nodejs
 */

// Current client version (matches versions.json on server)
const CLIENT_VERSION = '2.0.3';
const UPDATE_CHECK_INTERVAL = 3600000; // 1 hour

/**
 * Check if a newer client version is available
 * @returns {{ updateAvailable: boolean, serverVersion: string, changelog: string }}
 */
async function checkForUpdates() {
    console.log('[Updater] Checking for updates... (current: v' + CLIENT_VERSION + ')');

    try {
        const response = await authFetch('/api/poker/check-version');
        if (!response.ok) {
            throw new Error('Version check failed: ' + response.status);
        }

        const versions = await response.json();
        const serverVersion = versions.clientVersion || '0.0.0';
        const updateAvailable = compareVersions(serverVersion, CLIENT_VERSION) > 0;

        console.log('[Updater] Server version: v' + serverVersion + ', update available: ' + updateAvailable);

        return {
            updateAvailable,
            serverVersion,
            currentVersion: CLIENT_VERSION,
            scriptVersion: versions.scriptVersion || '0.0.0',
            assetVersion: versions.assetVersion || '0.0.0',
            changelog: versions.changelog || ''
        };
    } catch (error) {
        console.warn('[Updater] Update check failed:', error.message);
        return {
            updateAvailable: false,
            serverVersion: CLIENT_VERSION,
            currentVersion: CLIENT_VERSION,
            error: error.message
        };
    }
}

/**
 * Compare two semver-like version strings
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
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
        const response = await authFetch('/api/poker/client-bundle');
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Bundle download failed: ' + response.status);
        }

        const bundle = await response.json();

        if (!bundle.files || bundle.files.length === 0) {
            updateStatusUI('idle', 'No files to update');
            return { success: false, filesUpdated: 0, reason: 'empty_bundle' };
        }

        updateStatusUI('downloading', 'Installing ' + bundle.files.length + ' files...');

        // Get the extension directory using CEP API
        const csInterface = new CSInterface();
        const extensionDir = csInterface.getSystemPath(SystemPath.EXTENSION);

        // Write each file
        let filesUpdated = 0;
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
                console.log('[Updater] Updated: ' + file.path + ' (' + file.size + ' bytes)');
            } catch (fileErr) {
                console.error('[Updater] Failed to write ' + file.path + ':', fileErr.message);
            }
        }

        // Store the new version
        localStorage.setItem('poker_client_version', bundle.version);

        console.log('[Updater] Update complete: ' + filesUpdated + '/' + bundle.files.length + ' files updated to v' + bundle.version);
        updateStatusUI('success', 'Updated to v' + bundle.version + '! Restart panel to apply.');

        return { success: true, filesUpdated, version: bundle.version };
    } catch (error) {
        console.error('[Updater] Update failed:', error.message);
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
    const versionEl = document.getElementById('plugin-version');
    const btnEl = document.getElementById('btn-check-update');

    if (versionEl) {
        versionEl.textContent = 'v' + CLIENT_VERSION;
    }

    if (btnEl) {
        btnEl.addEventListener('click', async () => {
            btnEl.disabled = true;
            updateStatusUI('checking', 'Checking...');

            const result = await checkForUpdates();

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
 */
async function autoCheckUpdate() {
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
    } catch (e) {
        // Silent fail — don't disrupt the user
    }
}
