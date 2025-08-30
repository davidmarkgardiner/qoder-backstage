---
mode: agent
allowed-tools: Bash(git:*)
description: Prepare for pull request creation with git-only workflow
---

# Prepare for PR Creation

Prepare the current branch for pull request creation against the specified branch: `$ARGUMENTS`

## Steps to Follow

1. **ALWAYS start by running `git status`** to check what branch you're on and see current changes

2. **Ensure all changes are committed:**

   ```bash
   git add .
   git commit -m "Clear & descriptive commit message"
   ```

3. **Push the current branch to remote:**

   ```bash
   git push origin <current-branch>
   ```

4. **Provide PR creation guidance:**
   - Target branch: Use the branch specified by user (or default to 'dev')
   - **NEVER target 'main' branch**
   - Generate clear, concise PR title
   - Create detailed description of changes

5. **Output the manual PR creation instructions** with:
   - Current branch name
   - Target branch name
   - Suggested PR title
   - Suggested PR description

## Important Reminders

- Always verify the target branch before providing instructions
- Make titles clear & concise, and descriptions detailed yet focused
- **DO NOT credit yourself** in PR titles or descriptions
- Include relevant context about what changed and why
- Ensure all commits are pushed before creating PR

## Git Commands Used

```bash
# Check current status and branch
git status

# Check branch information
git branch -v

# Add and commit changes
git add .
git commit -m "Descriptive commit message"

# Push current branch
git push origin <branch-name>

# View recent commits
git log --oneline -5

# Check remote branches
git branch -r
```

## Output Format

After preparing the branch, provide:

```
✅ Branch prepared for PR creation

📋 **PR Details:**
- **Source Branch:** <current-branch>
- **Target Branch:** <specified-or-default-branch>
- **Suggested Title:** <clear-concise-title>
- **Suggested Description:**
  <detailed-description-of-changes>

🔗 **Next Steps:**
Go to your repository's web interface and create a pull request with the above details.
```

## Example Workflow

```bash
# 1. Check status
git status

# 2. Commit any pending changes
git add .
git commit -m "Add user authentication feature"

# 3. Push to remote
git push origin feature/user-auth

# 4. Provide PR creation guidance
```

<example>
**Source Branch:** feature/user-auth  
**Target Branch:** dev  
**Title:** "FEAT: Add user authentication with JWT tokens"  
**Description:** "Implements secure user authentication system with JWT token generation, validation middleware, and login/logout endpoints. Includes password hashing with bcrypt and proper error handling."
</example>
