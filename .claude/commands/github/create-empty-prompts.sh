#!/bin/bash

# Script to create empty GitHub Copilot prompt files
# Usage: ./create-empty-prompts.sh

PROMPTS_DIR="./.claude/commands/github/generated-prompts"

# Create the directory if it doesn't exist
mkdir -p "$PROMPTS_DIR"

# Create empty prompt files
touch "$PROMPTS_DIR/git-commit-semver.prompt.md"
touch "$PROMPTS_DIR/gitlab-ticket-creation.prompt.md"
touch "$PROMPTS_DIR/debug-session-capture.prompt.md"
touch "$PROMPTS_DIR/documentation-generation.prompt.md"
touch "$PROMPTS_DIR/create-pr.prompt.md"
touch "$PROMPTS_DIR/codebase-readme-generator.prompt.md"
touch "$PROMPTS_DIR/codebase-tree-generator.prompt.md"
touch "$PROMPTS_DIR/sre-runbook-generator.prompt.md"
touch "$PROMPTS_DIR/git-commit-push-semver.prompt.md"

echo "Empty prompt files created in $PROMPTS_DIR"