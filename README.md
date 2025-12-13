# Autonim_Poker

Adobe After Effects CEP Extension for automated poker card animations.

## Project Structure

```
Autonim_Poker/
├── CSXS/
│   └── manifest.xml          # Extension manifest with Node.js enabled
├── client/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── style.css         # Dark theme styling
│   └── js/
│       └── main.js           # Frontend logic
├── host/
│   └── index.jsx             # ExtendScript for After Effects
├── lib/
│   └── CSInterface.js        # ⚠️ DOWNLOAD THIS FILE
└── .debug                    # Debug configuration
```

## Installation Steps

### 1. Download CSInterface.js

**IMPORTANT:** You need to download the CSInterface.js library manually.

1. Go to: https://github.com/Adobe-CEP/CEP-Resources/tree/master/CEP_11.x
2. Download `CSInterface.js` from the repository
3. Place it in the `lib/` folder: `I:\WebAppDev\Autonim_Poker\lib\CSInterface.js`

### 2. Install Extension to After Effects

Copy the entire `Autonim_Poker` folder to your CEP extensions directory:

**Windows:**
```
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
```

**macOS:**
```
/Library/Application Support/Adobe/CEP/extensions/
```

### 3. Enable Debug Mode (Development)

To test the extension during development:

1. Create/edit the registry key (Windows) or plist file (macOS)
2. Set `PlayerDebugMode` to `1`

**Windows Registry:**
- Path: `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`
- Key: `PlayerDebugMode`
- Type: `String`
- Value: `1`

**macOS Terminal:**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

### 4. Launch Extension

1. Open After Effects
2. Go to `Window` → `Extensions` → `Autonim_Poker`
3. The panel should appear

## Features

- **Deal Cards:** Animate cards dealing from center to spread positions
- **Flip Cards:** Create card flip animations with 3D rotation
- **Shuffle Deck:** Random shuffle animation with multiple cards
- **Collect Cards:** Animate cards collecting back to center

## Configuration

- **Extension ID:** `com.vibecode.autonimpoker`
- **Extension Name:** Autonim_Poker
- **Node.js:** Enabled via CEFCommandLine parameters
- **Debug Port:** 8088

## Development

The extension uses:
- **CEP (Common Extensibility Platform)** for the panel UI
- **ExtendScript** for After Effects automation
- **CSInterface** for communication between UI and host app
- **Node.js** enabled for advanced functionality

## Troubleshooting

### Extension doesn't appear in After Effects
- Check that the folder is in the correct extensions directory
- Verify `PlayerDebugMode` is set to `1`
- Restart After Effects

### "CSInterface is not defined" error
- Make sure you downloaded `CSInterface.js` to the `lib/` folder
- Check the path in `index.html` is correct

### Animations not generating
- Check the ExtendScript console for errors
- Ensure you have an active composition or the script will create one

## Version

1.0.0

## Author

VibeCode
