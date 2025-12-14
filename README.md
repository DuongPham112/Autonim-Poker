# 🎴 Autonim-Poker
**Professional After Effects Director Tool for Poker Animations**

Autonim-Poker is an Adobe CEP extension that transforms After Effects into a powerful director tool for creating professionally animated poker game scenarios. It features a "Pose-to-Pose" recording system, allowing you to design card movements, flips, and effects intuitively before exporting them as high-quality After Effects animations.

---

## ✨ Features

- **🎬 Director Panel:** Dedicated UI for recording animation steps.
- **📍 Pose-to-Pose Recording:** Drag cards to any position, record snapshots, and let the tool calculate smooth animations automatically.
- **🔄 Flip & Slam Effects:** Easily add card flips and dramatic "slam" effects with a single click.
- **📂 Smart Asset Importing:** Import deck images directly from your local folders.
- **⏯️ Timeline Preview:** Visual timeline of your recorded steps.
- **🚀 One-Click Export:** Send your entire scenario directly to After Effects to generate a composition with proper keyframes, easing, and motion blur.

---

## 🛠️ System Requirements

- **OS:** Windows or macOS
- **After Effects:** 2020 (v17.0) or newer
- **Disk Space:** ~50MB

> **Note:** You DO NOT need to install Node.js separately. This extension uses the built-in Node.js runtime environment provided by Adobe After Effects.

---

## 📥 Installation

### 1. Enable Debug Mode (Required for unsigned extensions)
Since this is a developer extension, you must enable "PlayerDebugMode" in your registry.

*   **Windows:**
    1.  Locate the file `enable_debug_mode.reg` in this folder.
    2.  Double-click it and select **Yes** to update your registry.
*   **macOS:**
    Open Terminal and run: `defaults write com.adobe.CSXS.11 PlayerDebugMode 1` (Replace `.11` with your CSXS version if needed, e.g., `.14` for AE 2024).

### 2. Copy to Extensions Folder
Copy the entire `Autonim-Poker` folder to the Adobe CEP extensions directory:

*   **Windows:**  
    `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
*   **macOS:**  
    `/Library/Application Support/Adobe/CEP/extensions/`

### 3. Verification
1.  Open **Adobe After Effects**.
2.  Go to **Window > Extensions**.
3.  You should see **Autonim-Poker**. Click to open it!

---

## 📖 How to Use

### Step 1: Initialize Project
1.  In the Autonim-Poker panel, click **Select Assets Folder**.
2.  Choose the folder containing your card images (PNG/JPG).
3.  Click **Import Deck** to load the images onto the table.

### Step 2: Record Animation
1.  Verify you are in **RECORDING MODE** (Red indicator).
2.  **Start Position:** Arrange your cards for the initial scene.
3.  **Add Step:**
    *   Click **➕ Add New Step**.
    *   Set **Duration** (e.g., 1.5s).
    *   **Move Cards:** Drag cards to their new positions.
    *   **Add Effects:** Click a card and check **Flip Card** or **Slam Effect** in the Properties panel.
    *   Click **✓ Finish Step** when done.
4.  Repeat to create a sequence of steps.

### Step 3: Export to After Effects
1.  Click **🚀 Send to After Effects**.
2.  The extension will:
    *   Create a new Composition.
    *   Import all necessary images.
    *   Create layers and keyframes (Position, Rotation, Scale).
    *   Apply easing and motion blur automatically.

---

## 📁 Project Structure

```
Autonim-Poker/
├── client/              # Frontend (HTML/CSS/JS)
│   ├── index.html       # Director Panel UI
│   ├── css/style.css    # Dark Theme Styles
│   └── js/main.js       # Recording Logic
├── host/                # ExtendScript (After Effects Automation)
│   └── index.jsx        # Animation Generator Script
├── CSXS/                # Configuration
│   └── manifest.xml     # Extension Manifest
├── lib/                 # Libraries
│   └── CSInterface.js   # Adobe CEP Interface
└── enable_debug_mode.reg # Installer script
```

---

## 🐛 Troubleshooting

*   **Extension not showing up?**
    Make sure you copied the folder to the correct path and ran the `enable_debug_mode.reg` file.
*   **"Export failed"?**
    Make sure you have selected the **Assets Folder** correctly so After Effects knows where to find your images.

---

© 2025 VibeCode. Made with ❤️ for poker lovers.
