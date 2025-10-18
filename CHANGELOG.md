# BrainBrief Changelog

## [1.1.0] - 2025-10-18

### ✨ NEW FEATURE: Twitter Lists Support

**Extract tweets from Twitter Lists and sync to NotebookLM!**

**Features:**
- ✅ Extract tweets from any Twitter List
- ✅ Reuses bookmark extraction logic (YouTube, images, threads, etc.)
- ✅ Separate NotebookLM notebook per list
- ✅ List-specific notebook naming: `BrainBrief - {ListName} - {Date}`
- ✅ Enable/disable individual lists in config
- ✅ Integrated into Electron app tray menu
- ✅ CLI support: `npm run sync:lists`

**Database Schema:**
- Added `list_metadata` table for list information
- Added `list_tweets` table for tweet-list associations
- Many-to-many relationship (tweets can appear in multiple lists)

**New Scripts:**
- `npm run discover:lists` - Auto-discover your Twitter Lists
- `npm run sync:lists` - Sync all enabled lists
- `click-lists.js` - Interactive list discovery

**Electron App:**
- Added "Sync Lists" button to tray menu
- Renamed "Sync Now" to "Sync Bookmarks" for clarity

**Files Added:**
- `run-sync-lists.js` - CLI runner for lists
- `click-lists.js` - List discovery tool
- `lists-config.example.json` - Example configuration

**Files Modified:**
- `src/automation/twitter.js` - Added `extractListTweets()`
- `src/automation/notebooklm.js` - Added `uploadListTweets()`
- `src/db/schema.sql` - Added list tables and indexes
- `src/main/index.js` - Added "Sync Lists" menu item
- `package.json` - Added list-related scripts
- `README.md` - Added Lists documentation

---

## [1.0.1] - 2025-10-18

### 🐛 Bug Fixes

**Browser Lock Issue:**
- Added `fix-lock.sh` script to handle ProcessSingleton lock errors
- Added `npm run fix` command to auto-clean and sync
- Updated troubleshooting docs with quick fix instructions
- Prevents conflicts when Electron app and CLI run simultaneously

**Usage:**
```bash
npm run fix    # Auto-fix lock and sync
```

---

## [1.0.0] - 2025-10-18

### ✅ PRODUCTION READY - Full Twitter to NotebookLM Pipeline

#### Features Implemented

**Core Automation:**
- ✅ Twitter bookmark extraction with Playwright
- ✅ Incremental sync (only extracts NEW bookmarks)
- ✅ Automatic upload to Google NotebookLM
- ✅ SQLite database for bookmark tracking
- ✅ Smart duplicate detection

**Content Extraction:**
- ✅ YouTube URL extraction (from links and text)
- ✅ Image URL extraction (tweet media only, excludes profile pics)
- ✅ Video URL extraction
- ✅ Quoted tweet extraction
- ✅ PDF link detection
- ✅ Thread detection
- ✅ Embedded content in markdown export

**NotebookLM Integration:**
- ✅ Automatic notebook creation with date-based naming
- ✅ Notebook capacity tracking (300 sources max)
- ✅ File upload automation
- ✅ Notebook renaming after creation
- ✅ Existing notebook detection and reuse

**User Interfaces:**
- ✅ CLI: `npm run sync` for command-line usage
- ✅ Electron app with system tray menu
- ✅ "Sync Now" button in tray menu
- ✅ Daily auto-sync scheduling (8 AM)

#### Performance

- **Incremental Sync:** ~6 seconds when up-to-date
- **New Bookmarks:** ~30 seconds for 1-10 new items
- **Full Sync:** ~2 minutes for 100 bookmarks
- **Database:** In-memory sql.js with persistent storage

#### Technical Details

**Fixed Issues:**
- Fixed Playwright `page.evaluate()` multi-argument error
- Fixed image extraction to exclude profile pictures
- Fixed YouTube URL regex for text-based URLs
- Fixed function exports in run-sync.js
- Fixed database schema for embedded content
- Fixed notebook renaming timing (after upload)

**Database Schema:**
```sql
bookmarks (
  tweet_id TEXT PRIMARY KEY,
  author TEXT,
  text TEXT,
  url TEXT,
  timestamp TEXT,
  scraped_at TEXT,
  youtube_urls TEXT,  -- JSON array
  image_urls TEXT,     -- JSON array
  video_urls TEXT,     -- JSON array
  quoted_tweet TEXT    -- JSON object
)

notebooklm_notebooks (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  created_at TEXT,
  source_count INTEGER,
  max_sources INTEGER
)

notebooklm_uploads (
  id INTEGER PRIMARY KEY,
  notebook_id INTEGER,
  filename TEXT,
  uploaded_at TEXT,
  bookmark_count INTEGER
)
```

#### Usage

**CLI (Recommended):**
```bash
cd /Users/timothyjoo/YNG/ITEACHYOUAI/BrainBrief/brainbrief
npm run sync
```

**Electron App:**
```bash
npm start
# Then click tray icon → "Sync Now"
```

**Auto-Schedule:**
- Open Electron app
- Click tray icon → "Enable Daily Sync (8 AM)"

#### File Structure

```
brainbrief/
├── src/
│   ├── automation/
│   │   ├── twitter.js       # Twitter extraction
│   │   └── notebooklm.js    # NotebookLM upload
│   ├── db/
│   │   ├── database.js      # SQLite operations
│   │   ├── schema.sql       # Database schema
│   │   └── notebook-tracker.js
│   ├── main/
│   │   └── index.js         # Electron app
│   └── utils/
│       └── logger.js        # Logging system
├── data/
│   ├── brainbrief.db        # SQLite database
│   └── exports/             # Exported markdown files
├── browser-data/            # Playwright persistent context
├── run-sync.js              # CLI entry point
├── test-full-pipeline.js    # Integration test
└── package.json
```

#### Next Steps / Roadmap

**Potential Enhancements:**
- [ ] Twitter Lists support
- [ ] Custom sync schedules
- [ ] Webhook notifications
- [ ] Analytics dashboard
- [ ] Export to other formats (JSON, CSV)
- [ ] Multiple NotebookLM accounts
- [ ] Tweet search/filter in database
- [ ] Browser extension for one-click bookmark

#### Testing

**Test Coverage:**
- ✅ Database operations (test-database.js)
- ✅ Twitter extraction (test-twitter.js)
- ✅ Integration pipeline (test-integration.js)
- ✅ Full end-to-end (test-full-pipeline.js)
- ✅ NotebookLM upload (test-notebooklm.js)

**Last Test Results (2025-10-18):**
- Extracted: 100 bookmarks ✅
- Content breakdown:
  - Plain text: 94 (94%)
  - Images: 3 (3%)
  - Threads: 2 (2%)
  - PDFs: 1 (1%)
- Upload: Success ✅
- Incremental sync: 3 new bookmarks ✅
- Zero-change sync: 0 new bookmarks ✅

---

**Status:** ✅ Production Ready
**Last Updated:** 2025-10-18
**Version:** 1.0.0

