---
mode: agent
---

# Git Commit with Semantic Versioning

## Context

Generate git commit messages that follow conventional commit standards and determine appropriate semantic version bumps based on the changes being committed. This prompt helps maintain consistent commit history and automated version management.

## Task

Create a git commit with a properly formatted message and suggest the appropriate semantic version increment (major, minor, patch) based on the changes.

## Requirements

- Follow Conventional Commits specification (https://conventionalcommits.org/)
- Analyze staged changes to determine commit type and scope
- Suggest appropriate semver bump (major.minor.patch)
- Include breaking change indicators when applicable
- Generate concise but descriptive commit messages
- Handle multiple change types in a single commit

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types and Semver Impact

- `feat`: New feature (MINOR bump)
- `fix`: Bug fix (PATCH bump)
- `docs`: Documentation changes (PATCH bump)
- `style`: Code style changes (PATCH bump)
- `refactor`: Code refactoring (PATCH bump)
- `perf`: Performance improvements (PATCH bump)
- `test`: Test additions/changes (PATCH bump)
- `chore`: Build/tooling changes (PATCH bump)
- `ci`: CI/CD changes (PATCH bump)
- `build`: Build system changes (PATCH bump)
- `revert`: Revert previous commit (depends on reverted change)
- `BREAKING CHANGE`: Any breaking change (MAJOR bump)

## Example Outputs

### Feature Addition

```bash
git commit -m "feat(auth): add OAuth2 Google login integration

Implement Google OAuth2 authentication flow with secure token handling
and automatic user profile synchronization.

Closes #123"
# Suggested version bump: MINOR (1.2.0 -> 1.3.0)
```

### Bug Fix

```bash
git commit -m "fix(api): resolve null pointer exception in user service

Handle edge case where user profile data is missing during authentication.

Fixes #456"
# Suggested version bump: PATCH (1.2.3 -> 1.2.4)
```

### Breaking Change

```bash
git commit -m "feat(api)!: redesign user authentication endpoints

BREAKING CHANGE: Remove deprecated /auth/login endpoint, replace with /auth/v2/login.
All clients must update to use new authentication flow."
# Suggested version bump: MAJOR (1.2.3 -> 2.0.0)
```

## Workflow

1. Analyze `git status` and `git diff --staged` output
2. Categorize changes by type and scope
3. Identify any breaking changes
4. Generate appropriate commit message
5. Determine semantic version bump
6. Execute commit with generated message
7. Push changes to remote repository with `git push`
8. Display recommended version bump

## Additional Context

- For monorepos, include package/module scope in commit messages
- Consider grouping related changes into single commits when logical
- Use imperative mood in commit descriptions ("add" not "added")
- Keep first line under 72 characters for better git log readability
- Include issue/PR references when applicable
- Use body text for detailed explanations of complex changes
