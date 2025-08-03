#!/bin/bash

# Update dependencies script for Foreman
# Updates all npm dependencies to their latest versions

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${GREEN}Updating Foreman dependencies...${NC}"

# Array of packages to update
PACKAGES=(
    "foreman-core"
    "foreman-logger"
    "foreman-db"
    "foreman-server"
    "foreman-client"
)

# Update root dependencies
echo -e "${YELLOW}Updating root package dependencies...${NC}"
cd "$PROJECT_ROOT"
npm update

# Update each package
for package in "${PACKAGES[@]}"; do
    PACKAGE_DIR="$PROJECT_ROOT/node/packages/$package"
    
    if [ -d "$PACKAGE_DIR" ]; then
        echo -e "${YELLOW}Updating @codespin/$package dependencies...${NC}"
        cd "$PACKAGE_DIR"
        
        # Update dependencies
        npm update
        
        # Check for outdated packages
        echo -e "${YELLOW}Checking for outdated packages in $package...${NC}"
        npm outdated || true
    else
        echo -e "${RED}Warning: Package directory not found: $PACKAGE_DIR${NC}"
    fi
done

# Back to project root
cd "$PROJECT_ROOT"

# Run build to ensure everything still works
echo -e "${YELLOW}Running build to verify updates...${NC}"
if ./build.sh; then
    echo -e "${GREEN}✓ Dependencies updated successfully!${NC}"
    echo -e "${YELLOW}Note: Run 'npm outdated' in each package to see available major version updates${NC}"
else
    echo -e "${RED}✗ Build failed after dependency updates${NC}"
    echo -e "${RED}You may need to resolve compatibility issues${NC}"
    exit 1
fi