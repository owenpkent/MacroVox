-- API usage tracking for per-user rate limiting.
-- Populated by Netlify proxy functions (claude-proxy, deepgram-proxy).
-- Queried by the same functions to enforce hourly call limits.

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('claude', 'deepgram')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for efficient rate-limit lookups: (user, service, time window)
CREATE INDEX IF NOT EXISTS idx_api_usage_rate_limit
  ON api_usage (user_id, service, created_at DESC);

-- RLS: no user-facing access needed. Only the service role key
-- (used by Netlify functions) reads and writes this table.
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: delete rows older than 7 days to prevent unbounded growth.
-- Run via Supabase cron (pg_cron) or a scheduled function:
--   SELECT cron.schedule('cleanup-api-usage', '0 3 * * *',
--     $$DELETE FROM api_usage WHERE created_at < now() - interval '7 days'$$);
