#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_NAME="backend"
PROJECT_PATH="/var/www/Silksoul-Backend"
GIT_REPO="https://github.com/Hasafif/Silksoul-Backend.git"
BRANCH="main"
NODE_ENV="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment for $PROJECT_NAME${NC}"

# Navigate to project directory
cd $PROJECT_PATH

# Check for local changes
if ! git diff --quiet HEAD; then
    echo -e "${YELLOW}Local changes detected. Stashing changes...${NC}"
    git stash push -m "Auto-stash before deployment $(date)"
fi

# Check for staged changes
if ! git diff --cached --quiet; then
    echo -e "${YELLOW}Staged changes detected. Stashing staged changes...${NC}"
    git stash push --staged -m "Auto-stash staged changes before deployment $(date)"
fi

# Pull latest changes
echo -e "${YELLOW}Pulling latest changes from $BRANCH branch${NC}"
git fetch origin $BRANCH

# Reset to latest origin state (this will discard local changes)
echo -e "${YELLOW}Resetting to latest origin/$BRANCH${NC}"
git reset --hard origin/$BRANCH

# Clean untracked files
git clean -fd

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies${NC}"
npm ci --only=production

# Build project if build script exists
if npm run | grep -q "build"; then
    echo -e "${YELLOW}Building project${NC}"
    npm run build
fi

# Restart PM2 process
echo -e "${YELLOW}Restarting PM2 process${NC}"
if pm2 describe $PROJECT_NAME > /dev/null 2>&1; then
    pm2 restart $PROJECT_NAME
else
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

echo -e "${GREEN}Deployment completed successfully!${NC}"

# Show PM2 status
pm2 status