# NotebookLM Capacity Tracking System

**How BrainBrief prevents notebook overflow and tracks sources**

---

## The Problem

**NotebookLM Limits (per notebook):**
- Max sources: 300 (need to verify actual limit)
- Max file size per source: Unknown
- What happens when full: Upload fails or errors

**Without tracking:**
- Keep adding to same notebook
- Hit 300 source limit
- Upload fails
- User doesn't know why

---

## The Solution: Database Tracking

### **New Tables:**

**1. `notebooklm_notebooks` - Track notebooks**
```sql
CREATE TABLE notebooklm_notebooks (
  id INTEGER PRIMARY KEY,
  notebook_name TEXT UNIQUE,      -- "BrainBrief - Twitter Bookmarks"
  source_count INTEGER DEFAULT 0, -- Current: 47/300
  is_active INTEGER DEFAULT 1,    -- 1 = active, 0 = full/archived
  created_at TEXT,
  last_upload_at TEXT
);
```

**2. `uploaded_sources` - Track each upload**
```sql
CREATE TABLE uploaded_sources (
  id INTEGER PRIMARY KEY,
  notebook_id INTEGER,              -- Which notebook
  file_name TEXT,                   -- twitter-bookmarks-2025-10-17.txt
  bookmark_count INTEGER,           -- 50 bookmarks in this file
  uploaded_at TEXT
);
```

---

## The Flow (Automated Capacity Management)

### **Every Sync:**

```javascript
// Step 1: Get active notebook
const notebook = await getActiveNotebook();

// Returns:
{
  id: 1,
  name: "BrainBrief - Twitter Bookmarks",
  sourceCount: 47  // Current count
}

// Step 2: Check if full
if (notebook.sourceCount >= 300) {
  // Mark as inactive
  markNotebookInactive(notebook.id);
  
  // Create new notebook
  createNewNotebook();
  // Returns:
  {
    id: 2,
    name: "BrainBrief - Twitter Bookmarks 2",  // Auto-numbered
    sourceCount: 0
  }
}

// Step 3: Upload to active notebook
uploadToNotebookLM(notebook.name, file);

// Step 4: Record upload
recordUploadedSource(notebook.id, fileName, filePath, bookmarkCount);

// Step 5: Increment count
UPDATE notebooks SET source_count = source_count + 1 WHERE id = notebook.id;
```

---

## Real World Example

### **Day 1-299 (Under Capacity):**
```
Database:
  Notebook 1: "BrainBrief - Twitter Bookmarks"
    - source_count: 47
    - is_active: 1

Sync happens:
  1. Get active notebook → Notebook 1 (47/300 sources)
  2. Upload file
  3. Record upload
  4. Update count → 48/300
  5. ✅ Done
```

### **Day 300 (Hits Capacity):**
```
Database:
  Notebook 1: "BrainBrief - Twitter Bookmarks"
    - source_count: 300  ← FULL!
    - is_active: 1

Sync happens:
  1. Get active notebook → Notebook 1 (300/300 sources)
  2. CHECK: sourceCount >= 300? YES!
  3. Mark Notebook 1 as inactive (is_active = 0)
  4. Create Notebook 2: "BrainBrief - Twitter Bookmarks 2"
  5. Upload to Notebook 2
  6. Record upload
  7. ✅ Done

Database after:
  Notebook 1: 300 sources, is_active = 0 (archived)
  Notebook 2: 1 source, is_active = 1 (current)
```

### **Day 301+ (Using New Notebook):**
```
Database:
  Notebook 1: 300 sources, inactive
  Notebook 2: 5 sources, active ← Current

Sync happens:
  1. Get active notebook → Notebook 2 (5/300 sources)
  2. Upload file
  3. Record upload → 6/300
  4. ✅ Done
```

---

## User Queries NotebookLM

### **Before Rotation (Day 1-299):**
```
User opens: "BrainBrief - Twitter Bookmarks"
Query: "What are top insights?"
→ Searches 300 sources = 15,000 bookmarks
```

### **After Rotation (Day 301+):**
```
User has 2 notebooks:
  1. "BrainBrief - Twitter Bookmarks" (300 sources, 15,000 bookmarks)
  2. "BrainBrief - Twitter Bookmarks 2" (5 sources, 250 bookmarks)

To query ALL bookmarks:
  - Open Notebook 1, query
  - Open Notebook 2, query
  - Combine insights manually

OR (better):
  - Use BrainBrief UI to export combined markdown
  - Upload combined file to new "Master" notebook
```

---

## Benefits

### **1. Never Hit Limits**
- ✅ Auto-detects when notebook is full
- ✅ Creates new notebook automatically
- ✅ User never sees upload failures

### **2. Full Audit Trail**
```sql
-- See all uploads
SELECT * FROM uploaded_sources ORDER BY uploaded_at DESC;

-- See which notebook is current
SELECT * FROM notebooklm_notebooks WHERE is_active = 1;

-- See total bookmarks uploaded
SELECT SUM(bookmark_count) FROM uploaded_sources;
```

### **3. UI Can Show Status**
```
Current Notebook: "BrainBrief - Twitter Bookmarks"
Capacity: 47/300 sources (15.7% full)
Total Bookmarks: 2,350
Total Sources: 47
```

---

## Database Functions

```javascript
// Get current active notebook (or create first one)
await notebookTracker.getActiveNotebook();
// Returns: { id, name, sourceCount }

// Record an upload
await notebookTracker.recordUploadedSource(notebookId, fileName, filePath, bookmarkCount);
// Increments source_count, updates last_upload_at

// Get upload history
await notebookTracker.getUploadHistory(10);
// Returns: Last 10 uploads with notebook names
```

---

## Configuration

```javascript
// In notebook-tracker.js
const MAX_SOURCES_PER_NOTEBOOK = 300; // Adjust if NotebookLM limit is different
const NOTEBOOK_NAME_PREFIX = 'BrainBrief - Twitter Bookmarks';

// Notebook naming:
// - Notebook 1: "BrainBrief - Twitter Bookmarks"
// - Notebook 2: "BrainBrief - Twitter Bookmarks 2"
// - Notebook 3: "BrainBrief - Twitter Bookmarks 3"
```

---

## Testing Plan

### **Test 1: First Upload**
```bash
node test-notebooklm-upload.js
```
**Expected:** Creates Notebook 1, source_count = 1

### **Test 2: Second Upload**
```bash
node test-notebooklm-upload.js
```
**Expected:** Uses Notebook 1, source_count = 2

### **Test 3: Capacity Check**
```sql
-- Manually set to near-capacity
UPDATE notebooklm_notebooks SET source_count = 299 WHERE id = 1;
```
```bash
node test-notebooklm-upload.js
```
**Expected:** Uses Notebook 1, source_count = 300

### **Test 4: Rotation**
```sql
-- Manually set to full
UPDATE notebooklm_notebooks SET source_count = 300 WHERE id = 1;
```
```bash
node test-notebooklm-upload.js
```
**Expected:** 
- Marks Notebook 1 inactive
- Creates Notebook 2
- Uploads to Notebook 2
- source_count = 1

---

## Future Enhancements (v1.1)

**Store Notebook URL/ID:**
- NotebookLM notebooks have unique IDs in URL
- Store: `notebook_id = "abc123def"`
- More reliable than name matching

**Combined Export:**
- Export all bookmarks to one master file
- Upload to "Master" notebook
- Query everything in one place

**Smart Rotation:**
- Warn user at 290 sources (90% full)
- Let user decide when to rotate
- Don't auto-rotate without user consent

---

**Last Updated:** 2025-10-17  
**Status:** Tracking system implemented  
**Next:** Test automated upload with tracking

