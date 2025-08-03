#!/usr/bin/env bash
# -------------------------------------------------------------------
# start.sh – start the Foreman server
# -------------------------------------------------------------------
set -euo pipefail

# Load environment variables if .env exists
if [[ -f .env ]]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Start the server
echo "Starting Foreman server..."
cd node/packages/foreman-server
npm start