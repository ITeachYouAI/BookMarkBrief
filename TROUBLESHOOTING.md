# Troubleshooting Guide

## Issue: "NODE_MODULE_VERSION mismatch" with better-sqlite3

### Error Message:
```
The module 'better-sqlite3' was compiled against NODE_MODULE_VERSION 137
This version of Node.js requires NODE_MODULE_VERSION 139
```

### Root Cause:
- `better-sqlite3` is a native C++ module
- It must be compiled for Electron's specific Node.js version
- Your system Node.js ≠ Electron's Node.js version

### Solution 1: Use electron-rebuild (Recommended)

```bash
cd /path/to/brainbrief

# Install electron-rebuild as dev dependency
npm install --save-dev electron-rebuild

# Rebuild native modules for Electron
npx electron-rebuild

# Test
npm start
```

**This rebuilds better-sqlite3 for Electron's Node.js version.**

---

### Solution 2: Switch to sql.js (Pure JavaScript)

If electron-rebuild doesn't work, use sql.js (no native compilation):

```bash
# Remove better-sqlite3
npm uninstall better-sqlite3

# Install sql.js
npm install sql.js
```

Then update `src/db/database.js` to use sql.js instead.

**Trade-off:** Slightly slower, but no compilation issues.

---

### Solution 3: Rebuild on Every npm install (Automatic)

Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

This automatically rebuilds native modules after `npm install`.

---

## Quick Commands:

**Try this first:**
```bash
npm install --save-dev electron-rebuild
npx electron-rebuild
npm start
```

**If that fails:**
```bash
npm uninstall better-sqlite3
npm install sql.js
# Then update database.js to use sql.js
```

---

**Last Updated:** 2025-10-17

