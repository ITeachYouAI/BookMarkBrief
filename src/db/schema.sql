-- BrainBrief Database Schema
-- SQLite database for storing Twitter bookmarks and lists locally

-- Bookmarks table
-- Stores extracted Twitter bookmarks with full metadata + embedded content
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT UNIQUE NOT NULL,      -- Twitter tweet ID (unique)
  author TEXT NOT NULL,                -- Tweet author username
  text TEXT,                           -- Tweet text content
  url TEXT NOT NULL,                   -- Full tweet URL
  timestamp TEXT NOT NULL,             -- Original tweet timestamp (ISO 8601)
  scraped_at TEXT NOT NULL,            -- When we scraped it (ISO 8601)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- When we saved to DB
  -- NEW: Embedded content (stored as JSON)
  youtube_urls TEXT,                   -- JSON array of YouTube URLs
  image_urls TEXT,                     -- JSON array of image URLs
  video_urls TEXT,                     -- JSON array of video URLs
  quoted_tweet TEXT                    -- JSON object of quoted tweet
);

-- List metadata table
-- Stores Twitter list information
CREATE TABLE IF NOT EXISTS list_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT UNIQUE NOT NULL,        -- Twitter list ID
  list_name TEXT NOT NULL,             -- List display name
  list_url TEXT NOT NULL,              -- Full list URL
  enabled INTEGER DEFAULT 1,           -- 1 if enabled for sync, 0 if disabled
  max_tweets INTEGER DEFAULT 50,       -- Max tweets to extract per sync
  member_count TEXT,                   -- Number of members
  last_synced_at TEXT,                 -- Last sync timestamp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- List tweets table
-- Associates tweets with lists (many-to-many: a tweet can be in multiple lists)
CREATE TABLE IF NOT EXISTS list_tweets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL,               -- Twitter list ID
  tweet_id TEXT NOT NULL,              -- Tweet ID (references bookmarks)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tweet_id) REFERENCES bookmarks(tweet_id) ON DELETE CASCADE,
  FOREIGN KEY(list_id) REFERENCES list_metadata(list_id) ON DELETE CASCADE,
  UNIQUE(list_id, tweet_id)            -- Prevent duplicates
);

-- NotebookLM notebooks table
-- Tracks which NotebookLM notebook is active and source count
CREATE TABLE IF NOT EXISTS notebooklm_notebooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notebook_name TEXT UNIQUE NOT NULL,  -- Notebook name in NotebookLM
  notebook_id TEXT,                    -- NotebookLM ID (if we can get it)
  source_count INTEGER DEFAULT 0,      -- Number of sources uploaded
  is_active INTEGER DEFAULT 1,         -- 1 if active, 0 if full/archived
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_upload_at TEXT                  -- When we last added a source
);

-- Uploaded sources table
-- Tracks which files we've uploaded to which notebook
CREATE TABLE IF NOT EXISTS uploaded_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notebook_id INTEGER NOT NULL,        -- References notebooklm_notebooks
  file_name TEXT NOT NULL,             -- Filename uploaded
  file_path TEXT NOT NULL,             -- Local path to file
  bookmark_count INTEGER NOT NULL,     -- How many bookmarks in this file
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(notebook_id) REFERENCES notebooklm_notebooks(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_tweet_id ON bookmarks(tweet_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_scraped_at ON bookmarks(scraped_at);
CREATE INDEX IF NOT EXISTS idx_list_metadata_id ON list_metadata(list_id);
CREATE INDEX IF NOT EXISTS idx_list_metadata_enabled ON list_metadata(enabled);
CREATE INDEX IF NOT EXISTS idx_list_tweets_list ON list_tweets(list_id);
CREATE INDEX IF NOT EXISTS idx_list_tweets_tweet ON list_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_active ON notebooklm_notebooks(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_notebook ON uploaded_sources(notebook_id);

-- Stats view (for UI display)
CREATE VIEW IF NOT EXISTS bookmark_stats AS
SELECT 
  COUNT(DISTINCT bookmarks.tweet_id) as total_bookmarks,
  COUNT(DISTINCT list_tweets.list_id) as total_lists,
  MAX(bookmarks.scraped_at) as last_sync
FROM bookmarks
LEFT JOIN list_tweets ON bookmarks.tweet_id = list_tweets.tweet_id;

