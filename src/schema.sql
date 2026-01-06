-- Room metadata
CREATE TABLE IF NOT EXISTS room_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  room_id TEXT NOT NULL,
  current_stage TEXT NOT NULL CHECK (current_stage IN ('R', 'A', 'P', 'I', 'D')),
  selected_challenges TEXT, -- JSON array
  winning_idea_id INTEGER,
  tech_stack TEXT, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Initialize with default state
INSERT OR IGNORE INTO room_state (id, room_id, current_stage, created_at, updated_at)
VALUES (1, '', 'R', 0, 0);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'ai', 'system'))
);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- Ideas submitted by users
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('silent', 'group')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_phase ON ideas(phase);

-- Scoring votes
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  criterion TEXT NOT NULL CHECK (criterion IN ('feasibility', 'uniqueness', 'alignment', 'impact')),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  UNIQUE(idea_id, user_id, criterion)
);
CREATE INDEX IF NOT EXISTS idx_scores_idea ON scores(idea_id);

-- AI scoring and suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_suggestions(suggestion_type);

-- MVP features
CREATE TABLE IF NOT EXISTS mvp_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  category TEXT NOT NULL CHECK (category IN ('must_have', 'nice_to_have', 'out_of_scope')),
  sort_order INTEGER,
  created_at INTEGER NOT NULL
);

-- Work assignments
CREATE TABLE IF NOT EXISTS work_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  estimated_hours REAL,
  created_at INTEGER NOT NULL
);

-- Challenges (entered or parsed)
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sponsor TEXT,
  prize REAL,
  created_at INTEGER NOT NULL
);
