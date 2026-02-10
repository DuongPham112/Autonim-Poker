/**
 * Asset Manager Module — Autonim-Poker
 * Handles OTA updates for card assets, presets, etc.
 * Compares local version vs server manifest and downloads updates
 */

// ============================================
// ASSET VERSION TRACKING
// ============================================

const ASSET_VERSION_KEY = 'autonim_poker_asset_version';

/**
 * Check server for asset updates and download if needed
 * Uses authFetch from auth.js
 */
async function checkAssetUpdates() {
    console.log('[AssetManager] Checking for asset updates...');

    try {
        const response = await authFetch('/api/poker/asset-manifest');

        if (!response.ok) {
            console.warn('[AssetManager] Could not fetch manifest, skipping update check');
            return { updated: false, reason: 'manifest_unavailable' };
        }

        const manifest = await response.json();
        const localVersion = localStorage.getItem(ASSET_VERSION_KEY) || '0.0.0';

        console.log(`[AssetManager] Server: v${manifest.version}, Local: v${localVersion}`);

        if (manifest.version === localVersion || !manifest.assets || manifest.assets.length === 0) {
            console.log('[AssetManager] Assets are up to date');
            return { updated: false, reason: 'up_to_date' };
        }

        // Download each asset
        let downloadCount = 0;
        for (const asset of manifest.assets) {
            try {
                console.log(`[AssetManager] Downloading: ${asset.name}`);
                const assetResponse = await authFetch(`/api/poker/assets/${asset.name}`);

                if (assetResponse.ok) {
                    // In CEP, save to UserData directory
                    const csInterface = typeof CSInterface !== 'undefined' ? new CSInterface() : null;

                    if (csInterface) {
                        const blob = await assetResponse.blob();
                        const reader = new FileReader();

                        await new Promise((resolve, reject) => {
                            reader.onload = () => {
                                // Use Node.js fs to write file (available in CEP with --enable-nodejs)
                                try {
                                    const userDataPath = csInterface.getSystemPath(SystemPath.USER_DATA);
                                    const assetDir = `${userDataPath}/Autonim-Poker/assets`;

                                    // Create directory if needed
                                    const fs = require('fs');
                                    const path = require('path');

                                    if (!fs.existsSync(assetDir)) {
                                        fs.mkdirSync(assetDir, { recursive: true });
                                    }

                                    const filePath = path.join(assetDir, asset.name);
                                    const buffer = Buffer.from(reader.result);
                                    fs.writeFileSync(filePath, buffer);

                                    console.log(`[AssetManager] ✓ Saved: ${filePath}`);
                                    downloadCount++;
                                    resolve();
                                } catch (writeErr) {
                                    console.error(`[AssetManager] Failed to write ${asset.name}:`, writeErr);
                                    reject(writeErr);
                                }
                            };
                            reader.onerror = reject;
                            reader.readAsArrayBuffer(blob);
                        });
                    } else {
                        console.warn(`[AssetManager] Dev mode — skipping file write for ${asset.name}`);
                        downloadCount++;
                    }
                }
            } catch (assetErr) {
                console.error(`[AssetManager] Failed to download ${asset.name}:`, assetErr);
            }
        }

        localStorage.setItem(ASSET_VERSION_KEY, manifest.version);
        console.log(`[AssetManager] ✓ Updated ${downloadCount}/${manifest.assets.length} assets to v${manifest.version}`);

        return { updated: true, version: manifest.version, count: downloadCount };

    } catch (error) {
        if (error.name === 'AuthError') throw error;
        console.warn('[AssetManager] Asset update check failed:', error.message);
        return { updated: false, reason: 'error', error: error.message };
    }
}

/**
 * Get local asset version
 */
function getLocalAssetVersion() {
    return localStorage.getItem(ASSET_VERSION_KEY) || '0.0.0';
}
