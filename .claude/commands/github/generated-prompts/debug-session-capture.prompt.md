---
mode: agent
---

# Debugging Session Documentation Capture

## Context

Generate structured documentation that captures debugging sessions, including the problem identified, investigation process, root cause analysis, and solution implemented. This helps build institutional knowledge and prevent recurring issues.

## Task

Create comprehensive debugging session reports that document the entire problem-solving process from initial symptoms through final resolution, making the knowledge reusable for future debugging efforts.

## Requirements

- Clear problem statement with symptoms and impact
- Step-by-step investigation process
- Root cause analysis with technical details
- Solution implementation with code examples
- Prevention measures and lessons learned
- Timeline and effort estimation for similar issues

## Documentation Structure Template

````markdown
# Debug Session: [Brief Problem Description]

**Date**: YYYY-MM-DD  
**Duration**: X hours  
**Severity**: Critical/High/Medium/Low  
**Components**: [affected systems/modules]

## Problem Statement

**Symptoms**:

- [Observable behavior 1]
- [Observable behavior 2]

**Impact**: [Business/user impact description]
**Environment**: [production/staging/development]

## Investigation Process

### Initial Observations

- [What was first noticed]
- [Error messages/logs]
- [Affected user reports]

### Debugging Steps

1. **Step 1**: [Action taken] → [Result/Finding]
2. **Step 2**: [Action taken] → [Result/Finding]
3. **Step 3**: [Action taken] → [Result/Finding]

### Tools Used

- [Debugging tools, monitoring systems, logs]
- [Commands run, queries executed]

## Root Cause Analysis

**Primary Cause**: [Technical explanation of what went wrong]
**Contributing Factors**:

- [Factor 1]
- [Factor 2]

**Code Location**: `file:line` or commit hash
**Timeline**: [When the issue was introduced]

## Solution Implementation

### Code Changes

```language
// Before (problematic code)
[original code snippet]

// After (fixed code)
[corrected code snippet]
```
````

### Configuration Changes

- [Config file updates]
- [Environment variable changes]

### Database Changes

```sql
-- Migration or data fixes applied
```

## Verification

- [How the fix was tested]
- [Metrics that confirmed resolution]
- [User acceptance validation]

## Prevention Measures

- [Code review improvements]
- [Additional monitoring/alerts]
- [Process changes]
- [Documentation updates]

## Lessons Learned

- [Key insights for future debugging]
- [Warning signs to watch for]
- [Tools or techniques that were most effective]

## Related Issues

- [Links to similar past issues]
- [Related bug reports or tickets]

````

## Example Documentation

### Database Performance Issue
```markdown
# Debug Session: API Response Timeouts During Peak Hours

**Date**: 2024-01-15
**Duration**: 4 hours
**Severity**: High
**Components**: User API, PostgreSQL Database

## Problem Statement
**Symptoms**:
- API response times >30 seconds during 9-11 AM
- Timeout errors in user dashboard
- 500 status codes for user profile requests

**Impact**: 40% of morning users unable to access profiles
**Environment**: Production

## Investigation Process

### Initial Observations
- CloudWatch showed DB CPU at 95%
- Slow query log filled with user profile queries
- Connection pool exhaustion in application logs

### Debugging Steps
1. **Check database metrics** → High CPU, disk I/O spikes
2. **Analyze slow query log** → `SELECT * FROM users WHERE status = 'active'` taking 25s
3. **Examine query execution plan** → Full table scan on 2M row table
4. **Check index usage** → Missing index on status column

### Tools Used
- AWS CloudWatch for metrics
- `EXPLAIN ANALYZE` for query plans
- `pg_stat_statements` for query statistics

## Root Cause Analysis
**Primary Cause**: Missing database index on `users.status` column causing full table scans
**Contributing Factors**:
- Recent user data growth (500k → 2M users)
- Query pattern change in v2.1.0 release

**Code Location**: `src/models/User.js:42` - `findActiveUsers()` method
**Timeline**: Issue introduced with v2.1.0 deployment on 2024-01-10

## Solution Implementation

### Database Changes
```sql
-- Added missing index
CREATE INDEX CONCURRENTLY idx_users_status ON users(status);

-- Query optimization
-- Before: SELECT * FROM users WHERE status = 'active'
-- After: SELECT id, name, email FROM users WHERE status = 'active' AND created_at > NOW() - INTERVAL '1 year'
````

### Code Changes

```javascript
// Before (selecting all columns)
const activeUsers = await User.findAll({
  where: { status: "active" },
});

// After (selecting only needed columns with pagination)
const activeUsers = await User.findAll({
  attributes: ["id", "name", "email"],
  where: {
    status: "active",
    createdAt: { [Op.gte]: oneYearAgo },
  },
  limit: 1000,
  offset: page * 1000,
});
```

## Verification

- Query time reduced from 25s to 45ms
- API response time back to <500ms
- CPU usage dropped to 20% during peak hours
- No timeout errors in 24hr monitoring period

## Prevention Measures

- Added database index monitoring to CI/CD
- Implemented query performance tests
- Created alerts for slow query detection (>1s)
- Added database query review checklist

## Lessons Learned

- Always consider index requirements when adding new query patterns
- Monitor database performance metrics continuously
- Large dataset queries need pagination by default
- Test performance impact of new features under load

## Related Issues

- #1245: Similar performance issue resolved 6 months ago
- #1891: User growth impact on system performance

```

## Output Guidelines
- Use consistent markdown formatting
- Include specific technical details and code snippets
- Add timestamps and effort estimates
- Link to related documentation or tickets
- Focus on actionable insights for future debugging
- Include both immediate fixes and long-term improvements

## Additional Context
- Adapt the template based on issue type (performance, security, data integrity, etc.)
- Include screenshots or diagrams when they clarify the problem
- Document failed attempts and dead ends to save future investigation time
- Consider creating runbooks for common issue patterns discovered
```
