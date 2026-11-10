BEGIN;

CREATE TABLE IF NOT EXISTS operation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scope varchar(60) NOT NULL,
  idempotency_key uuid NOT NULL,
  fingerprint varchar(64) NOT NULL,
  entity_type varchar(60),
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS operation_requests_actor_scope_key_uq
  ON operation_requests(actor_id, scope, idempotency_key);
CREATE INDEX IF NOT EXISTS operation_requests_actor_created_idx
  ON operation_requests(actor_id, created_at);

COMMIT;
