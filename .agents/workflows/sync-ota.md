---
description: Sync Autonim-Poker client to BannerGeneratorAI server for OTA updates
---

# Sync OTA Release

This workflow syncs the Autonim-Poker client files to the BannerGeneratorAI backend so existing users get the update via OTA.

## Prerequisites
- Autonim-Poker code is committed and pushed
- CLIENT_VERSION in `client/js/modules/updater.js` matches the release version
- Version in `index.html` (`pluginVersion`) matches

## Steps

// turbo-all

1. Run the sync script:
```powershell
powershell -ExecutionPolicy Bypass -File "I:\WebDev\Autonim-Poker\scripts\sync-ota.ps1" -Changelog "<changelog message>"
```

2. Deploy BannerGeneratorAI to Vercel:
```powershell
cd I:\WebDev\BannerGeneratorAI; npx vercel --prod
```

3. Verify the OTA version on server:
```powershell
Invoke-RestMethod -Uri "https://banner-generator-ai.vercel.app/api/poker/check-version" | ConvertTo-Json
```

## Notes
- The sync script copies `client/` → `server/poker-assets/client-bundle/`, updates `versions.json`, and commits/pushes BannerGeneratorAI
- GitHub repo is private — no CI/CD needed, sync is local
- After Vercel deploy, existing CEP plugin users will see "Update available" on next boot
