#!/usr/bin/env bash
# run-site.sh — Run Playwright monitoring for a single site
# Usage: ./scripts/run-site.sh <site-id>
#        or source .env.site-001 first then call with no args

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SITE_ID="${1:-${SITE_ID:-default}}"
ENV_FILE="${ROOT}/.env.sites/${SITE_ID}.env"

# Load per-site env file if it exists
if [[ -f "${ENV_FILE}" ]]; then
  echo "[run-site] Loading env from ${ENV_FILE}"
  set -o allexport
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +o allexport
elif [[ -f "${ROOT}/.env" ]]; then
  echo "[run-site] Loading env from .env"
  set -o allexport
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +o allexport
fi

export SITE_ID="${SITE_ID}"

STORAGE_STATE="${ROOT}/.auth/state-${SITE_ID}.json"
export STORAGE_STATE

REPORT_DIR="${ROOT}/reports/artifacts/${SITE_ID}"
mkdir -p "${REPORT_DIR}" "${ROOT}/.auth" "${ROOT}/reports/json" "${ROOT}/reports/logs"

echo "[run-site] Site: ${SITE_ID} | ${SITE_NAME:-unknown}"
echo "[run-site] ERP:  ${BASE_URL:-not set}"
echo "[run-site] MW:   ${MIDDLEWARE_BASE_URL:-not set}"

cd "${ROOT}"

npx playwright test \
  --reporter=list,json \
  --output="${REPORT_DIR}" \
  2>&1 | tee "${ROOT}/reports/logs/${SITE_ID}-$(date +%Y%m%d-%H%M%S).log"

EXIT_CODE=${PIPESTATUS[0]}

echo "[run-site] Finished: ${SITE_ID} — exit ${EXIT_CODE}"
exit "${EXIT_CODE}"
