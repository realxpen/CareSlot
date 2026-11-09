-- Run once in the Neon SQL Editor. All tables belong only to this assessment project.
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  start_text TEXT NOT NULL,
  end_text TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- The database, not an application-side availability check, enforces this invariant.
CREATE UNIQUE INDEX IF NOT EXISTS only_one_confirmed_booking_per_slot
  ON bookings (slot_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_for_email
  ON bookings (email, created_at, id);

CREATE TABLE IF NOT EXISTS idempotency_results (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  retry_after INT
);

CREATE TABLE IF NOT EXISTS booking_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS recent_attempts_by_email
  ON booking_attempts (email, attempted_at);
