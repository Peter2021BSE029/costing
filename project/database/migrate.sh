#!/bin/bash
# Applies incremental SQL migrations against the costing database, in order.
# Safe to re-run: each migration guards its own changes (IF NOT EXISTS / null-only backfills).
#
# Usage (from anywhere): bash project/database/migrate.sh
# Reads DB connection settings from project/.env (same file the backend server uses).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

export PGPASSWORD="${DB_PASS:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-costing_db}"

MIGRATIONS=(
  "add_fixed_pricing.sql"
  "add_quotations.sql"
  "add_quotation_name.sql"
  "add_vat_option.sql"
  "add_quotation_text_fields.sql"
  "add_client_contacts.sql"
  "add_job_spec_summary.sql"
  "add_user_full_name.sql"
  "add_created_by.sql"
  "add_costing_agent_and_widen_job_name.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "==> Applying $migration"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/$migration"
done

echo "==> Migrations complete."
