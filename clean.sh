#!/usr/bin/env bash
# -------------------------------------------------------------------
# clean.sh – clean build artifacts
# -------------------------------------------------------------------
set -euo pipefail

echo "=== Cleaning Foreman ==="

# Define packages
PACKAGES=(
  "foreman-core"
  "foreman-logger"
  "foreman-db"
  "foreman-server"
  "foreman-client"
  "foreman-integration-tests"
)

# Clean dist directories
for pkg_name in "${PACKAGES[@]}"; do
  dist_dir="node/packages/$pkg_name/dist"
  if [[ -d "$dist_dir" ]]; then
    echo "Cleaning $dist_dir…"
    rm -rf "$dist_dir"
  fi
done

echo "=== Clean completed successfully ==="