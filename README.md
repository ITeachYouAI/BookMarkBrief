# BrainBrief

**Sync Twitter bookmarks & lists to NotebookLM**

> Status: 🚧 In Development (v1.0 MVP)

---

## What is BrainBrief?

BrainBrief automatically extracts your Twitter bookmarks and curated lists, then uploads them to Google's NotebookLM so you can query them with AI.

**The Problem:**
- You have 500+ Twitter bookmarks you never read
- You curate Twitter Lists (AI experts, marketing gurus, etc.) but never consume them systematically
- NotebookLM could organize and synthesize all this content, but there's no automatic sync

**The Solution:**
BrainBrief runs in your system tray, syncs your Twitter content on a schedule (daily/weekly/monthly), and uploads it to NotebookLM notebooks organized by list.

---

## Features (v1.0)

- ✅ Extract Twitter bookmarks
- ✅ Extract Twitter Lists (user-selectable)
- ✅ Save locally (organized by date + list name)
- ✅ Upload to NotebookLM (separate notebooks per list)
- ✅ Background scheduling (daily/weekly/monthly)
- ✅ System tray app (Mac menubar / Windows systray)

---

## Quick Start

### Prerequisites

- Node.js 18+ (download from [nodejs.org](https://nodejs.org))
- Git (download from [git-scm.com](https://git-scm.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/brainbrief.git
cd brainbrief

# Install dependencies
npm install

# Run the app
npm start
```

The app will launch and appear in your system tray.

---

## Project Structure

```
brainbrief/
├── src/
│   ├── main/           # Electron main process (system tray, scheduling)
│   ├── renderer/       # UI (setup wizard, settings)
│   ├── automation/     # Playwright scripts (Twitter, NotebookLM)
│   └── db/             # SQLite schemas and queries
├── browser-data/       # Persistent browser sessions (stays logged in)
├── data/               # Extracted bookmarks and lists
├── logs/               # Sync logs
└── package.json
```

---

## Development

### Tech Stack

- **Desktop Framework:** Electron (Chromium + Node.js)
- **Browser Automation:** Playwright (persistent sessions)
- **Database:** SQLite (local-first)
- **Scheduling:** node-schedule (cron)
- **Language:** JavaScript / Node.js

### Why This Stack?

See [Decision 001](../Decisions/001-desktop-vs-web-vs-extension.md) for the full rationale:
- **Desktop over Web:** Zero hosting costs, local-first data
- **Electron over Tauri:** Faster iteration with AI pair programming
- **Playwright over Selenium:** Better persistent session handling
- **SQLite over PostgreSQL:** Zero setup for users

---

## Roadmap

### Week 1 (Oct 14-20) ✅ IN PROGRESS
- [x] Project initialization
- [x] Decision 001: Desktop vs Web vs Extension
- [x] Basic Electron app with system tray
- [ ] Playwright integration (persistent Twitter login)
- [ ] Bookmark extraction (scrape 50+ bookmarks)

### Week 2 (Oct 21-27)
- [ ] NotebookLM upload automation
- [ ] Separate notebooks per Twitter list
- [ ] End-to-end validation (Twitter → local → NotebookLM)

### Week 3 (Oct 28-Nov 3)
- [ ] Background scheduling (node-schedule)
- [ ] Setup wizard UI
- [ ] List selection interface
- [ ] Settings panel

### Week 4 (Nov 4-10)
- [ ] Documentation (README, troubleshooting guide)
- [ ] GitHub release preparation
- [ ] Video content (first 5 videos published)

---

## Content & Learning

BrainBrief is not just a tool—it's a teaching artifact. I'm documenting every decision, debugging session, and failure publicly to demonstrate AI automation thinking.

**Video Series (in progress):**
1. Why I'm Building BrainBrief
2. Desktop vs Web vs Extension: My Decision Framework
3. Scraping Twitter Bookmarks: First 50 Lines of Code
4. Handling Rate Limiting Without Getting Blocked
5. NotebookLM Integration: Browser Automation Without an API

[Full content calendar →](../Content-Ideas.md)

---

## Contributing

This is an educational project built in public. Contributions welcome!

**How to contribute:**
1. Open an issue describing what you want to add/fix
2. Fork the repo
3. Create a branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Submit a PR

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built as part of the [iTeachYouAI.com](https://iteachyouai.com) content series
- Inspired by the need to make Twitter bookmarks actually useful
- Thanks to the Playwright and Electron communities for excellent documentation

---

## Questions?

- **GitHub Issues:** [Open an issue](https://github.com/yourusername/brainbrief/issues)
- **Email:** timothy@iteachyouai.com
- **Twitter:** [@yourhandle](https://twitter.com/yourhandle)

---

**Last Updated:** October 17, 2025  
**Current Version:** 1.0.0-alpha  
**Status:** Active Development

