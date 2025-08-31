---
mode: agent
---

# GitLab Issue Creation - Concise and Clear

## Context

Generate GitLab issue descriptions that are brief but contain all essential information. Focus on creating tickets that developers can quickly understand and act upon without excessive detail.

## Task

Create concise GitLab issue content including title, description, and metadata that communicates the problem or feature request clearly in minimal words.

## Requirements

- Title under 60 characters, descriptive and actionable
- Description under 200 words maximum
- Include essential context only
- Clear acceptance criteria (3-5 bullet points max)
- Appropriate labels and priority
- Minimal but sufficient reproduction steps for bugs

## Issue Structure Template

```markdown
**Problem/Goal**: [One sentence describing the issue or objective]

**Current Behavior**: [Brief description of what happens now]
**Expected Behavior**: [Brief description of desired outcome]

**Acceptance Criteria**:

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Labels**: `bug`, `feature`, `enhancement`, `high-priority`
**Assignee**: @username
**Milestone**: Sprint 2024-Q1
```

## Example Outputs

### Bug Report

```markdown
Title: Login fails with 500 error on password reset

**Problem**: Users cannot reset passwords due to server error

**Current**: Password reset form submits but returns 500 error
**Expected**: User receives reset email and can update password

**Steps**:

1. Navigate to login page
2. Click "Forgot Password"
3. Enter valid email
4. Submit form → 500 error

**Acceptance Criteria**:

- [ ] Password reset emails are sent successfully
- [ ] Users can complete password reset flow
- [ ] No 500 errors during reset process

Labels: bug, high-priority, authentication
```

### Feature Request

```markdown
Title: Add dark mode toggle to user settings

**Goal**: Allow users to switch between light and dark themes

**Benefit**: Improved user experience and reduced eye strain

**Acceptance Criteria**:

- [ ] Toggle switch in user settings page
- [ ] Theme persists across sessions
- [ ] All components support both themes
- [ ] Respects system preference by default

Labels: feature, ui/ux, medium-priority
Estimate: 5 story points
```

### Enhancement

```markdown
Title: Optimize API response time for user dashboard

**Problem**: Dashboard loads slowly (>3s) affecting user experience

**Current**: Average load time 4.2 seconds
**Target**: Reduce to under 1.5 seconds

**Acceptance Criteria**:

- [ ] Dashboard loads in <1.5 seconds
- [ ] API response time <500ms
- [ ] Maintain all current functionality
- [ ] Add performance monitoring

Labels: enhancement, performance, backend
```

## Guidelines for Conciseness

- Use bullet points instead of paragraphs
- Eliminate redundant words ("in order to" → "to")
- Use active voice ("System crashes" not "The system is crashing")
- Focus on impact and solution, not background
- Include only essential technical details
- Use established team terminology and abbreviations

## Quality Checklist

- Title is action-oriented and specific
- Problem and solution are clearly stated
- Success criteria are measurable
- Essential information is present
- No unnecessary context or backstory
- Proper labels and metadata assigned

## Additional Context

- Optimize for mobile reading (developers often triage on phones)
- Use GitLab markdown formatting for better readability
- Include relevant screenshots only if they clarify the issue
- Link to related issues using `#issue-number` format
- Tag relevant team members only when input is needed
