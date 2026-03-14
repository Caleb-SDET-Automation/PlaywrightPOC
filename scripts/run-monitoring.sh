#!/usr/bin/env bash
# run-monitoring.sh — Primary entry point for RunDeck unattended execution
# Runs all sites or a specific group, then generates consolidated report.
#
# Usage:
#   ./scripts/run-monitoring.sh [GROUP] [CONCURRENCY]
#
# Environment:
#   SITE_GROUP=us-east       — limit to this group
#   SITE_CONCURRENCY=6       — parallel site runs
#   CHECKMK_URL              — CheckMK server URL
#   CHECKMK_SECRET           — CheckMK automation secret

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load global env
[[ -f "${ROOT}/.env" ]] && {
  set -o allexport
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +o allexport
}

export SITE_GROUP="${1:-${SITE_GROUP:-}}"
export SITE_CONCURRENCY="${2:-${SITE_CONCURRENCY:-5}}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${ROOT}/reports/logs/orchestrator-${TIMESTAMP}.log"

mkdir -p "${ROOT}/reports/logs"

echo "========================================================"
echo "  Playwright Synthetic Monitor — ${TIMESTAMP}"
echo "  Group: ${SITE_GROUP:-all} | Concurrency: ${SITE_CONCURRENCY}"
echo "========================================================"

cd "${ROOT}"

# Install if node_modules missing
[[ ! -d node_modules ]] && npm ci --silent

# Install Playwright browsers if missing
npx playwright install chromium --with-deps 2>/dev/null || true

# Run orchestrator
node scripts/run-all-sites.js 2>&1 | tee "${LOG_FILE}"
ORCHESTRATOR_EXIT=${PIPESTATUS[0]}

echo ""
echo "Log saved to: ${LOG_FILE}"
echo "Report dir:   ${ROOT}/reports/consolidated/"
echo "========================================================"

exit "${ORCHESTRATOR_EXIT}"
