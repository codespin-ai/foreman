#!/bin/bash

# Docker push script for Foreman
# Usage: ./docker-push.sh [tag] [registry]

set -e

# Default values
IMAGE_NAME="foreman"
DEFAULT_TAG="latest"
DEFAULT_REGISTRY=""

TAG="${1:-$DEFAULT_TAG}"
REGISTRY="${2:-$DEFAULT_REGISTRY}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Construct full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}"
fi

echo -e "${GREEN}Pushing Foreman Docker image...${NC}"

# Check if image exists locally
if ! docker images "${IMAGE_NAME}:${TAG}" | grep -q "${IMAGE_NAME}"; then
    echo -e "${RED}Error: Image ${IMAGE_NAME}:${TAG} not found locally${NC}"
    echo "Please build the image first using ./docker-build.sh"
    exit 1
fi

# Tag image for registry if needed
if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}Tagging image for registry: ${FULL_IMAGE_NAME}:${TAG}${NC}"
    docker tag "${IMAGE_NAME}:${TAG}" "${FULL_IMAGE_NAME}:${TAG}"
    
    # Also tag git commit version if it exists
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    if [ -n "$GIT_COMMIT" ] && docker images "${IMAGE_NAME}:${GIT_COMMIT}" | grep -q "${IMAGE_NAME}"; then
        docker tag "${IMAGE_NAME}:${GIT_COMMIT}" "${FULL_IMAGE_NAME}:${GIT_COMMIT}"
    fi
fi

# Push the image
echo -e "${YELLOW}Pushing ${FULL_IMAGE_NAME}:${TAG}...${NC}"
docker push "${FULL_IMAGE_NAME}:${TAG}"

# Push git commit tag if it exists
if [ -n "$GIT_COMMIT" ] && [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}Pushing ${FULL_IMAGE_NAME}:${GIT_COMMIT}...${NC}"
    docker push "${FULL_IMAGE_NAME}:${GIT_COMMIT}"
fi

echo -e "${GREEN}Successfully pushed ${FULL_IMAGE_NAME}:${TAG}${NC}"
if [ -n "$GIT_COMMIT" ]; then
    echo -e "${GREEN}Also pushed ${FULL_IMAGE_NAME}:${GIT_COMMIT}${NC}"
fi