# BrainBrief - Build & Distribution Guide

**Version:** 1.3.0  
**Date:** 2025-10-19

---

## 📦 **How to Package for Distribution**

### **Prerequisites:**

1. **Install electron-builder:**
```bash
npm install --save-dev electron-builder
```

2. **Create app icon** (optional but recommended):
   - Place icon at: `assets/icon.png`
   - Recommended size: 512x512px or 1024x1024px
   - Format: PNG with transparency

---

### **Build for macOS:**

```bash
# Build DMG installer (macOS only)
npm run build

# Output: dist/BrainBrief-1.3.0.dmg
# Output: dist/BrainBrief-1.3.0-mac.zip
```

**What you get:**
- `BrainBrief-1.3.0.dmg` - Installer for distribution
- `BrainBrief-1.3.0-mac.zip` - Portable version

**File size:** ~200-300MB (includes Chromium for automation)

---

### **Build for All Platforms:**

```bash
# Build for macOS, Windows, and Linux
npm run build:all

# Outputs:
# - dist/BrainBrief-1.3.0.dmg (macOS)
# - dist/BrainBrief-1.3.0.exe (Windows)
# - dist/BrainBrief-1.3.0.AppImage (Linux)
```

**Note:** You need to be on macOS to build .dmg files.

---

## 🚀 **Distribution Options**

### **Option 1: GitHub Releases** (Recommended)

1. **Create a release on GitHub:**
```bash
git tag v1.3.0
git push origin v1.3.0
```

2. **Upload built files to GitHub Releases:**
   - Go to your repo → Releases → New Release
   - Upload `BrainBrief-1.3.0.dmg`
   - Add release notes from CHANGELOG.md

3. **Users download:**
   - Download .dmg file
   - Drag to Applications folder
   - Done!

---

### **Option 2: Direct Download** (Simple)

1. **Build the app:**
```bash
npm run build
```

2. **Upload DMG to:**
   - Your website
   - Dropbox/Google Drive
   - Send directly to users

3. **Share link**

---

### **Option 3: Mac App Store** (Advanced)

**Requirements:**
- Apple Developer Account ($99/year)
- Code signing certificate
- App Store review process

**Not recommended for v1.3.0** - too much overhead for an automation tool.

---

## 📝 **What to Include in Release**

### **Release Files:**
- ✅ `BrainBrief-1.3.0.dmg` (macOS installer)
- ✅ `README.md` (included in repo)
- ✅ `CHANGELOG.md` (version history)

### **Release Notes:**

```markdown
# BrainBrief v1.3.0

## 🎉 YouTube Auto-Transcription!

Automatically transcribe YouTube videos from your Twitter bookmarks.

### Features:
- ✅ Sync Twitter bookmarks to NotebookLM
- ✅ Auto-transcribe YouTube videos
- ✅ Twitter Lists support
- ✅ Incremental sync (fast!)
- ✅ Clean minimal UI

### Requirements:
- macOS 10.13+
- Twitter account
- Google account (for NotebookLM)

### Installation:
1. Download BrainBrief-1.3.0.dmg
2. Open the DMG
3. Drag BrainBrief to Applications
4. Open BrainBrief from Applications
5. Click "Sync Bookmarks" to start!

### First Run:
- Browser will open for Twitter login
- Browser will open for Google/NotebookLM login
- Credentials saved securely on your Mac
- Future syncs are automatic!

Download: [BrainBrief-1.3.0.dmg](link)
```

---

## 🔒 **Security & Privacy**

### **What Gets Packaged:**
- ✅ App code
- ✅ Chromium (for automation)
- ✅ Dependencies

### **What's NOT Packaged (User Data):**
- ❌ Browser sessions (created on first run)
- ❌ Database (created on first run)
- ❌ Bookmarks (user's data)

**User data location:** `~/Library/Application Support/brainbrief/`

---

## 🛠️ **Build Configuration**

Already configured in `package.json`:

```json
{
  "build": {
    "appId": "com.iteachyouai.brainbrief",
    "productName": "BrainBrief",
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"]
    }
  }
}
```

---

## 📊 **Build Process (What Happens)**

```bash
npm run build
```

**Steps:**
1. Packages Electron app
2. Bundles all dependencies
3. Includes Playwright/Chromium
4. Creates installer (DMG)
5. Output: `dist/` folder

**Time:** ~2-5 minutes  
**Size:** ~250MB (large because includes Chromium)

---

## ⚡ **Quick Build & Test**

```bash
# 1. Install build tool
npm install --save-dev electron-builder

# 2. Build
npm run build

# 3. Test the DMG
open dist/BrainBrief-1.3.0.dmg

# 4. Install and run
# Drag to Applications
# Open from Applications
# Test sync!
```

---

## 🚨 **Known Issues with Distribution**

### **macOS Gatekeeper:**
- First time users open: "App from unidentified developer"
- **Solution:** Users right-click → Open (bypasses Gatekeeper)
- **Better solution:** Code signing (requires Apple Developer account)

### **File Size:**
- App is ~250MB (includes Chromium browser)
- **Why:** Playwright needs full Chromium for automation
- **Can't reduce:** This is necessary for Twitter/NotebookLM automation

### **Permissions:**
- macOS may ask for permissions (Accessibility, etc.)
- Users need to grant these for automation to work

---

## 💰 **Cost to Distribute**

### **Free Options:**
- ✅ GitHub Releases (free, unlimited)
- ✅ Your website (just hosting)
- ✅ Direct download links

### **Paid Options:**
- Mac App Store: $99/year
- Code signing: $99/year (Apple Developer)
- Notarization: Included with Developer account

---

## 🎯 **Recommendation for v1.3.0**

**Use GitHub Releases (free & easy):**

1. Build the app: `npm run build`
2. Create GitHub Release
3. Upload DMG file
4. Share link

**Users get:**
- One-click download
- Drag-to-install
- Auto-updates (future feature)

---

**Want me to run the build now and create a release?**

