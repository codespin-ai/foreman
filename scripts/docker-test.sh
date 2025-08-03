#!/bin/bash

# Docker test script for Foreman
# Runs tests inside a Docker container with a test database

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="foreman"
TAG="${1:-latest}"
NETWORK_NAME="foreman-test-network"
DB_CONTAINER_NAME="foreman-test-db"
TEST_CONTAINER_NAME="foreman-test-runner"

echo -e "${GREEN}Running Foreman tests in Docker...${NC}"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up test containers...${NC}"
    docker rm -f "$DB_CONTAINER_NAME" "$TEST_CONTAINER_NAME" 2>/dev/null || true
    docker network rm "$NETWORK_NAME" 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Create test network
echo -e "${YELLOW}Creating test network...${NC}"
docker network create "$NETWORK_NAME" 2>/dev/null || true

# Start PostgreSQL container
echo -e "${YELLOW}Starting PostgreSQL test database...${NC}"
docker run -d \
    --name "$DB_CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -e POSTGRES_DB=foreman_test \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    postgres:16-alpine

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker exec "$DB_CONTAINER_NAME" pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}Database is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Database failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Run tests in container
echo -e "${YELLOW}Running tests...${NC}"
docker run \
    --name "$TEST_CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -e NODE_ENV=test \
    -e FOREMAN_DB_HOST="$DB_CONTAINER_NAME" \
    -e FOREMAN_DB_PORT=5432 \
    -e FOREMAN_DB_NAME=foreman_test \
    -e FOREMAN_DB_USER=postgres \
    -e FOREMAN_DB_PASSWORD=postgres \
    -e UNRESTRICTED_DB_USER=postgres \
    -e UNRESTRICTED_DB_USER_PASSWORD=postgres \
    -e RLS_DB_USER=postgres \
    -e RLS_DB_USER_PASSWORD=postgres \
    -e JWT_SECRET=test-secret-key \
    -e LOG_LEVEL=error \
    --rm \
    "${IMAGE_NAME}:${TAG}" \
    bash -c "npm run migrate:foreman:latest && npm test"

# Check test results
if [ $? -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Tests failed!${NC}"
    exit 1
fi