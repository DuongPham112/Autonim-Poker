---
description: Sync Autonim-Poker client to BannerGeneratorAI server for OTA updates
---

# Sync OTA Release

This workflow syncs the Autonim-Poker client files to the BannerGeneratorAI backend so existing users get the update via OTA.

**Version check** uses GitHub Raw URL (auto-updated via git push to Autonim-Poker repo).
**Bundle download** uses BannerGeneratorAI server (need Vercel deploy).

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

2. Deploy BannerGeneratorAI to Vercel (for bundle download only):
```powershell
cd I:\WebDev\BannerGeneratorAI; npx vercel --prod
```

3. Verify the version check from GitHub Raw URL:
```powershell
Invoke-RestMethod -Uri "https://raw.githubusercontent.com/DuongPham112/Autonim-Poker/main/versions.json" | ConvertTo-Json
```

## Notes
- Version check: reads `versions.json` from GitHub Raw URL (public repo). Cache delay ~5 phút sau khi push.
- Bundle download: reads `client-bundle/` from BannerGeneratorAI server (cần Vercel deploy).
- Sync script commits `versions.json` to Autonim-Poker repo (NOT BannerGeneratorAI).
- Server endpoint `/api/poker/check-version` vẫn giữ nguyên làm fallback.
