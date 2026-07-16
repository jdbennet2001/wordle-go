#!/usr/bin/env bash
#
# Runs inside the downloaded bundle. Brings up the product from ECR with
# docker compose. Called by wordle-install.sh after preflight + download;
# can also be run directly once the bundle is present locally.
#
set -euo pipefail
cd "$(dirname "$0")"

# Load the deploy target so we can print the right URL.
set -a
# shellcheck disable=SC1091
. ./.env.ecr
set +a

echo "Starting wordle (registry: ${REGISTRY})..."
docker compose --env-file .env.ecr up -d

echo
docker compose --env-file .env.ecr ps
echo
echo "Wordle is running. Open http://localhost:${HOST_PORT:-2000}"
echo "To stop it:  cd $(pwd) && docker compose --env-file .env.ecr down"
