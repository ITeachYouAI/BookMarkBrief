# BrainBrief

**Automatically sync your Twitter bookmarks to Google NotebookLM for AI-powered analysis.**

## 🚀 Quick Start

```bash
# Run sync (extracts new bookmarks and uploads to NotebookLM)
npm run sync

# Or use Electron app with GUI
npm start
```

## ✨ Features

- ✅ **Incremental sync** - Only extracts NEW bookmarks (fast!)
- ✅ **Twitter Lists support** - Extract tweets from any Twitter List
- ✅ **Rich content extraction** - YouTube URLs, images, PDFs, quoted tweets
- ✅ **Smart duplicate detection** - Never uploads the same bookmark twice
- ✅ **Automatic NotebookLM upload** - Hands-free integration
- ✅ **Separate notebooks per list** - Organized by topic
- ✅ **Daily auto-sync** - Set it and forget it
- ✅ **Local database** - All your bookmarks stored in SQLite

## 📋 Requirements

- Node.js 16+
- Twitter/X account with bookmarks
- Google account for NotebookLM

## 🛠️ Installation

```bash
# Install dependencies
npm install

# First run (extracts all bookmarks)
npm run sync
```

## 💡 Usage

### Command Line (Recommended)

```bash
npm run sync
```

**What it does:**
1. Opens Twitter in automated browser
2. Extracts NEW bookmarks (incremental)
3. Saves to local database
4. Uploads to NotebookLM automatically
5. Done in ~30 seconds!

### Electron App

```bash
npm start
```

**Features:**
- System tray icon
- "Sync Bookmarks" button
- "Sync Lists" button
- Enable daily auto-sync (8 AM)
- System notifications

### Twitter Lists

**Step 1: Open Settings**
```bash
npm start
```
Click **"Settings"** button in the app

**Step 2: Discover Lists (One-time)**
In Settings page:
- Click **"Discover Lists"**
- Browser opens and finds all your Twitter Lists
- Returns to Settings showing all lists with checkboxes

**Step 3: Select Lists to Sync**
- ✅ Check the lists you want to sync
- ❌ Uncheck lists you want to skip
- Set **"Days Back"** (default: 3 days for speed)
- Set **"Max Tweets"** (default: 50)
- Click **"Save Settings"**

**Step 4: Sync**
Go back to main page and click **"Sync Lists"**

**Result:**
Each enabled list creates a separate NotebookLM notebook:
```
BrainBrief - AI Leaders #2 of 2 - 2025-10-18
BrainBrief - Gauntlet AI Cohort 1 - 2025-10-18
BrainBrief - Solana Influencers - 2025-10-18
```

**Performance:**
- 3-day filter: ~30 seconds per list ⚡
- 7-day filter: ~60 seconds per list
- All time: 2-5 minutes per list (not recommended)

## 📊 What Gets Extracted

### Basic Info
- Tweet text
- Author
- URL
- Timestamp

### Embedded Content
- **YouTube URLs** - For NotebookLM video transcription
- **Images** - Direct links to tweet media (excludes profile pics)
- **Videos** - Video URLs
- **Quoted Tweets** - Original tweet author and text
- **PDFs** - Document links
- **Threads** - Multi-tweet content

## 📁 File Structure

```
brainbrief/
├── data/
│   ├── brainbrief.db          # Your bookmarks database
│   └── exports/               # Markdown exports to NotebookLM
├── browser-data/              # Saved login sessions
├── src/
│   ├── automation/            # Twitter & NotebookLM automation
│   ├── db/                    # Database operations
│   └── utils/                 # Logger, helpers
└── run-sync.js                # CLI entry point
```

## 🔒 Privacy

- All data stored **locally** in SQLite
- No cloud services (except Twitter & NotebookLM)
- Browser sessions saved for convenience (can be deleted)
- No analytics or tracking

## 🐛 Troubleshooting

### "Failed to create ProcessSingleton"
**Problem:** Browser lock file preventing sync

**Quick Fix:**
```bash
npm run fix
```

**Manual Fix:**
1. Close the Electron app: `pkill -f "electron.*brainbrief"`
2. Remove lock file: `rm -f browser-data/SingletonLock`
3. Run sync: `npm run sync`

**Prevention:** Don't run Electron app and CLI sync at the same time

### "Not logged in to Twitter"
**Solution:** Run sync once, log in manually in the browser window

### "Notebook full (300 sources)"
**Solution:** App will create a new dated notebook automatically

## 📝 Example Output

```markdown
## Bookmark 42

**Author:** John Doe
**URL:** https://x.com/johndoe/status/123
**Date:** 2025-10-18T12:00:00.000Z

**Content:**
Check out my latest video on AI automation!

**YouTube Videos:**
- https://www.youtube.com/watch?v=abc123

**Images:**
- https://pbs.twimg.com/media/G3U849.jpg

**Quoted Tweet:**
> Author: Jane Smith
> This is the original tweet being quoted
```

## 🎯 NotebookLM Integration

Your bookmarks appear in a notebook named:
```
BrainBrief - Twitter Bookmarks - 2025-10-18
```

**You can ask NotebookLM:**
- "Show me YouTube videos"
- "Summarize the threads"
- "What PDFs are included?"
- "Find tweets about AI automation"

## 🔧 Advanced

### Custom Sync Schedule

Edit `src/main/index.js`:
```javascript
cronExpression: '0 8 * * *'  // Change to your preferred time
```

### Sync Limits

Edit `src/automation/twitter.js`:
```javascript
const MAX_NEW_BOOKMARKS = 500;  // Max per sync
const BATCH_SIZE = 20;          // Tweets per batch
```

## 📚 Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [CONVENTIONS.md](./CONVENTIONS.md) - Code style guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design

## 🤝 Contributing

This is a personal automation tool, but feel free to fork and customize!

## 📄 License

MIT

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** 2025-10-18
