CREATE TABLE IF NOT EXISTS safety_accounts (
  user_id TEXT PRIMARY KEY NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 0 CHECK (violation_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_safety_accounts_updated_at ON safety_accounts(updated_at);
