# NotebookLM Automation Flow

**How BrainBrief accumulates bookmarks in one notebook**

---

## The Strategy: ONE Notebook, Multiple Sources

```
Notebook: "BrainBrief - Twitter Bookmarks"
│
├─ Day 1: twitter-bookmarks-2025-10-17.txt (50 tweets)
├─ Day 2: twitter-bookmarks-2025-10-18.txt (50 tweets)  
├─ Day 3: twitter-bookmarks-2025-10-19.txt (50 tweets)
└─ Day 7: twitter-bookmarks-2025-10-24.txt (50 tweets)

Total: 4 sources = 200 bookmarks in ONE notebook
Query: "What are the top insights from all my bookmarks?"
```

---

## Automation Flow

### **First Sync (Notebook Doesn't Exist):**

```
User clicks "Sync Now"
    ↓
Extract 50 bookmarks from Twitter
    ↓
Save to database
    ↓
Create file: twitter-bookmarks-2025-10-17.txt
    ↓
Open NotebookLM
    ↓
Look for "BrainBrief - Twitter Bookmarks" notebook
    ↓
NOT FOUND → Click "New notebook"
    ↓
Notebook created (named "Untitled notebook")
    ↓
Click "+ Add" button
    ↓
setInputFiles(twitter-bookmarks-2025-10-17.txt)
    ↓
Wait for "1 source" to appear
    ↓
✅ DONE - Notebook has first source
```

---

### **Second Sync (Notebook Exists):**

```
User clicks "Sync Now" (next day)
    ↓
Extract 50 NEW bookmarks
    ↓
Save to database
    ↓
Create file: twitter-bookmarks-2025-10-18.txt
    ↓
Open NotebookLM
    ↓
Look for "BrainBrief - Twitter Bookmarks" notebook
    ↓
FOUND → Click on existing notebook card
    ↓
Notebook opens (already has 1 source from Day 1)
    ↓
Click "+ Add" button
    ↓
setInputFiles(twitter-bookmarks-2025-10-18.txt)
    ↓
Wait for "2 sources" to appear
    ↓
✅ DONE - Notebook now has 2 sources (100 bookmarks total)
```

---

## The Code Logic

```javascript
// Check if notebook exists
const exists = await page.locator('text=BrainBrief - Twitter Bookmarks').isVisible();

if (exists) {
  // DAY 2+: Open existing notebook
  await page.click('text=BrainBrief - Twitter Bookmarks');
  logger.info('Opened existing notebook (will add source)');
  
} else {
  // DAY 1: Create new notebook
  await page.click('button:has-text("New notebook")');
  logger.info('Created new notebook (first source)');
}

// Wait for Sources panel to load
await page.waitForSelector('text=Sources');

// Add source (SAME CODE for both paths)
await page.click('button:has-text("Add")');
await page.setInputFiles('input[type="file"]', filePath);
await page.waitForSelector(`text=${filename}`);

logger.success('Source added!');
// Day 1: Notebook has 1 source
// Day 2: Notebook has 2 sources
// Day 7: Notebook has 7 sources (all queryable together)
```

---

## Why This Matters

### **User Experience:**
```
Week 1:
- Monday: Sync → 50 bookmarks in notebook
- Tuesday: Sync → 100 bookmarks in notebook (cumulative)
- Friday: Sync → 250 bookmarks in notebook

User queries NotebookLM:
"What are the top 10 insights from all my bookmarks?"
→ Searches across ALL 250 bookmarks (not just today's)
```

### **vs Bad Approach (New Notebook Each Time):**
```
Week 1:
- Monday: Notebook "Oct 14" → 50 bookmarks
- Tuesday: Notebook "Oct 15" → 50 bookmarks
- Friday: Notebook "Oct 18" → 50 bookmarks

User queries:
"What are insights from my bookmarks?"
→ Only searches ONE notebook at a time (not useful)
→ User has to switch between 5 notebooks (annoying)
```

---

## Implementation Details

### **Notebook Detection:**
```javascript
// Look for notebook by name (text content)
const notebook = page.locator('text=BrainBrief - Twitter Bookmarks');
const exists = await notebook.isVisible({ timeout: 3000 });
```

### **Source Addition (Works for New AND Existing):**
```javascript
// After notebook is open (whether new or existing):
await page.click('button:has-text("Add")');          // Opens upload modal
await page.setInputFiles('input[type="file"]', path); // Uploads file
await page.waitForSelector(`text=${filename}`);       // Confirms appeared
```

### **Success Verification:**
```javascript
// Day 1: Wait for "1 source"
// Day 2: Wait for "2 sources"
// Works automatically because filename is unique
await page.waitForSelector(`text=${filename}`);
```

---

## Edge Cases Handled

### **Case 1: Notebook Renamed**
- User manually renames "Untitled notebook" → "My Bookmarks"
- Next sync: Won't find "BrainBrief - Twitter Bookmarks"
- Creates new notebook (duplicates)
- **Fix in v1.1:** Store notebook ID, not name

### **Case 2: Notebook Deleted**
- User deletes the notebook
- Next sync: Won't find it
- Creates new notebook (correct behavior)

### **Case 3: Multiple Notebooks with Same Name**
- Shouldn't happen (NotebookLM enforces unique names)
- If it does: Click first match

---

## Test Plan

### **Test 1: First Upload (New Notebook)**
```bash
node test-notebooklm-upload.js
```

**Expected:**
- Creates new notebook
- Uploads TEST-UPLOAD.txt
- Logs: "First sync complete!"

### **Test 2: Second Upload (Existing Notebook)**
```bash
node test-notebooklm-upload.js
```

**Expected:**
- Finds existing notebook
- Opens it
- Adds another source
- Logs: "Bookmarks added to existing notebook"

---

## Current Limitation (v1.0)

**Notebook Naming:**
- First sync creates "Untitled notebook" (can't rename programmatically yet)
- User should manually rename it to "BrainBrief - Twitter Bookmarks"
- Future syncs will then find it by name

**v1.1 Fix:**
- Store notebook ID in database
- Use ID instead of name to find notebook
- More reliable

---

**Last Updated:** 2025-10-17  
**Status:** Logic implemented, ready to test  
**Next:** Run test-notebooklm-upload.js to validate

