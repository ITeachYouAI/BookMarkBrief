-- BrainBrief Database Schema
-- SQLite database for storing Twitter bookmarks and lists locally

-- Bookmarks table
-- Stores extracted Twitter bookmarks with full metadata
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT UNIQUE NOT NULL,      -- Twitter tweet ID (unique)
  author TEXT NOT NULL,                -- Tweet author username
  text TEXT,                           -- Tweet text content
  url TEXT NOT NULL,                   -- Full tweet URL
  timestamp TEXT NOT NULL,             -- Original tweet timestamp (ISO 8601)
  scraped_at TEXT NOT NULL,            -- When we scraped it (ISO 8601)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP  -- When we saved to DB
);

-- Lists table
-- Stores which Twitter lists each bookmark belongs to
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_name TEXT NOT NULL,             -- Twitter list name
  list_id TEXT,                        -- Twitter list ID (optional)
  tweet_id TEXT NOT NULL,              -- Tweet ID (references bookmarks)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tweet_id) REFERENCES bookmarks(tweet_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_tweet_id ON bookmarks(tweet_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_scraped_at ON bookmarks(scraped_at);
CREATE INDEX IF NOT EXISTS idx_lists_list_name ON lists(list_name);
CREATE INDEX IF NOT EXISTS idx_lists_tweet_id ON lists(tweet_id);

-- Stats view (for UI display)
CREATE VIEW IF NOT EXISTS bookmark_stats AS
SELECT 
  COUNT(DISTINCT bookmarks.tweet_id) as total_bookmarks,
  COUNT(DISTINCT lists.list_name) as total_lists,
  MAX(bookmarks.scraped_at) as last_sync
FROM bookmarks
LEFT JOIN lists ON bookmarks.tweet_id = lists.tweet_id;

