# BrainBrief Coding Conventions

**Last Updated:** 2025-10-17  
**Status:** Enforced from Day 1

---

## Core Principles

1. **Consistency > Cleverness** - Same patterns everywhere
2. **Reliability > Speed** - Every function handles errors
3. **Clarity > Brevity** - Explicit is better than implicit

---

## File Structure

```
src/
├── main/           # Electron main process
├── renderer/       # UI (HTML/CSS/JS)
├── automation/     # Browser automation (Playwright)
├── db/             # Database (SQLite)
└── utils/          # Shared utilities
```

**Rule:** One module per file. No mega-files.

---

## Naming Conventions

### Files
- `lowercase-kebab-case.js` for modules
- `PascalCase.js` for classes (rare, we prefer functions)

### Variables
```javascript
// Constants (module-level config)
const TWITTER_URL = 'https://twitter.com';
const MAX_RETRIES = 3;

// Regular variables (camelCase)
let pageCount = 0;
const userData = {};

// Private functions (prefix with _)
function _validateInput(data) { }

// Public functions (no prefix)
function extractBookmarks() { }
```

---

## Function Structure

**Every function follows this template:**

```javascript
/**
 * Brief description (one line)
 * 
 * @param {Type} paramName - Description
 * @returns {Object} { success, data, error }
 */
async function functionName(paramName) {
  try {
    // 1. Validate inputs
    if (!paramName) {
      throw new Error('paramName is required');
    }
    
    // 2. Do work
    const result = await doSomething(paramName);
    
    // 3. Return standard format
    return {
      success: true,
      data: result,
      error: null
    };
    
  } catch (error) {
    // 4. Log error
    logger.error('functionName failed', error);
    
    // 5. Return standard format
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}
```

**Standard return format (ALWAYS):**
```javascript
{
  success: boolean,  // true if operation succeeded
  data: any,         // result data (null if failed)
  error: string      // error message (null if succeeded)
}
```

---

## Error Handling

**Rule:** Every async function has try-catch. No exceptions.

```javascript
// ❌ BAD
async function doSomething() {
  const result = await riskyOperation();
  return result;
}

// ✅ GOOD
async function doSomething() {
  try {
    const result = await riskyOperation();
    return { success: true, data: result, error: null };
  } catch (error) {
    logger.error('doSomething failed', error);
    return { success: false, data: null, error: error.message };
  }
}
```

---

## Logging System

**Use centralized logger (not console.log directly)**

```javascript
const logger = require('../utils/logger');

logger.info('Starting process');     // ℹ️ Info
logger.success('Process complete');  // ✅ Success
logger.warn('Rate limit approaching'); // ⚠️ Warning
logger.error('Process failed', error); // ❌ Error
logger.debug('Variable value', data); // 🔍 Debug (dev only)
```

**Log levels:**
- `INFO` - Normal operations (blue)
- `SUCCESS` - Completed successfully (green)
- `WARN` - Something unusual but not broken (yellow)
- `ERROR` - Something failed (red)
- `DEBUG` - Developer info (gray, only in dev mode)

**Format:** `[TIMESTAMP] [LEVEL] [MODULE] Message`

Example:
```
[2025-10-17 14:32:10] [INFO] [twitter] Starting bookmark extraction
[2025-10-17 14:32:15] [SUCCESS] [twitter] Extracted 10 bookmarks
[2025-10-17 14:32:20] [ERROR] [twitter] Failed to connect: Network timeout
```

---

## Async/Await

**Rule:** Always use async/await. No .then() chains.

```javascript
// ❌ BAD
function getData() {
  return fetch(url)
    .then(res => res.json())
    .then(data => process(data))
    .catch(error => console.log(error));
}

// ✅ GOOD
async function getData() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return { success: true, data, error: null };
  } catch (error) {
    logger.error('getData failed', error);
    return { success: false, data: null, error: error.message };
  }
}
```

---

## Configuration

**Rule:** All magic numbers/strings in constants at top of file.

```javascript
// ❌ BAD
await page.waitForTimeout(2000);
if (retries > 3) { }

// ✅ GOOD
const SCROLL_DELAY_MS = 2000;
const MAX_RETRIES = 3;

await page.waitForTimeout(SCROLL_DELAY_MS);
if (retries > MAX_RETRIES) { }
```

---

## Comments

**When to comment:**
- ✅ WHY you made a decision (not WHAT the code does)
- ✅ Trade-offs accepted
- ✅ Future TODOs
- ✅ Complex business logic

**When NOT to comment:**
- ❌ Obvious code (`i++; // increment i`)
- ❌ Repeating function names in comments

```javascript
// ❌ BAD
// Get bookmarks
function getBookmarks() { }

// ✅ GOOD
// Use persistent context to avoid re-authentication on every run
// Trade-off: Browser data stored locally (privacy-first)
const context = await chromium.launchPersistentContext(dataDir);
```

---

## Database Queries

**Rule:** Use parameterized queries. Never string concatenation.

```javascript
// ❌ BAD
db.query(`SELECT * FROM bookmarks WHERE id = ${userId}`);

// ✅ GOOD
db.query('SELECT * FROM bookmarks WHERE id = ?', [userId]);
```

---

## Testing Strategy

**Every module has a test file:**
- `twitter.js` → `twitter.test.js`
- Run with: `node twitter.test.js`

**Test structure:**
```javascript
async function testFunctionName() {
  logger.info('Testing functionName...');
  
  const result = await functionName(testInput);
  
  if (result.success) {
    logger.success('✅ Test passed');
  } else {
    logger.error('❌ Test failed', result.error);
  }
}
```

---

## Git Commits

**Format:** `[component] verb: description`

Examples:
- `[twitter] add: bookmark extraction with rate limiting`
- `[db] fix: duplicate detection query`
- `[ui] update: status display formatting`
- `[docs] add: API documentation`

**Components:** twitter, notebooklm, db, ui, electron, docs, tests

---

## TODOs

**Format:** `TODO(scope): description`

```javascript
// TODO(performance): Cache results to avoid re-scraping
// TODO(v1.1): Add duplicate detection
// TODO(security): Encrypt stored credentials
```

**Scopes:** performance, security, ux, v1.1, v2.0, optimization

---

## File Headers

**Every file starts with:**
```javascript
/**
 * BrainBrief - [Module Name]
 * 
 * Purpose: [One sentence describing what this module does]
 * Dependencies: [List key external dependencies]
 * 
 * @module [module-name]
 */
```

---

## API Design

**For any module with multiple functions, export object:**

```javascript
// ❌ BAD
module.exports = extractBookmarks;

// ✅ GOOD
module.exports = {
  extractBookmarks,
  extractLists,
  validateSession
};
```

---

## Constants Organization

**Group related constants:**

```javascript
// Browser configuration
const BROWSER_HEADLESS = false;
const BROWSER_WIDTH = 1280;
const BROWSER_HEIGHT = 900;

// Rate limiting
const SCROLL_DELAY_MS = 2000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5000;

// URLs
const TWITTER_BASE_URL = 'https://twitter.com';
const TWITTER_BOOKMARKS_URL = `${TWITTER_BASE_URL}/i/bookmarks`;
const TWITTER_LISTS_URL = `${TWITTER_BASE_URL}/i/lists`;
```

---

## Code Review Checklist

Before committing, verify:

- [ ] Every async function has try-catch
- [ ] All functions return standard `{ success, data, error }` format
- [ ] Using logger (not console.log)
- [ ] All magic numbers in constants
- [ ] File has header comment
- [ ] Functions have JSDoc comments
- [ ] No TODO without scope
- [ ] Git commit follows format

---

## Why These Conventions?

1. **Standard return format** → Easier to chain functions, predictable error handling
2. **Centralized logger** → Easy to add file logging later, consistent formatting
3. **Try-catch everywhere** → App never crashes, always graceful degradation
4. **Constants at top** → Easy to tweak values, clear configuration
5. **JSDoc comments** → AI assistants understand code better, easier refactoring

---

**These are not suggestions. These are requirements.**

If you see code that violates these conventions, refactor it immediately.

---

**Last Updated:** 2025-10-17  
**Enforced:** All code from Day 1 forward

