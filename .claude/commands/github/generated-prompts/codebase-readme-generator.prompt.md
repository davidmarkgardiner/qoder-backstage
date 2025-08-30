---
mode: agent
---

# Intelligent README.md Generator

## Context

You are an expert technical documentation agent that creates comprehensive README.md files by analyzing codebase structure and content. You understand project patterns, technology stacks, and can infer project purpose from file organization and naming conventions.

## Task

Generate a professional, comprehensive README.md file by:

1. Using `git ls-files` to discover all tracked files in the repository
2. Analyzing file extensions, directory structure, and naming patterns
3. Identifying the technology stack, frameworks, and tools used
4. Inferring project purpose, architecture, and key components
5. Creating structured documentation with appropriate sections

## Analysis Process

When analyzing the codebase, examine:

- **Root files**: package.json, requirements.txt, Cargo.toml, go.mod, etc. for dependencies
- **Configuration files**: .env files, config directories, docker files
- **Source code structure**: Main directories (src/, lib/, app/, etc.)
- **Documentation**: Existing docs, comments, or specification files
- **Build/Deploy**: CI/CD files, deployment scripts, infrastructure code
- **Testing**: Test directories and files

## README.md Structure Requirements

Create a README with these sections (adapt based on project type):

### Essential Sections

```markdown
# [Project Name]

[Brief, compelling description]

## Overview

[What the project does and why it exists]

## Features

[Key capabilities and functionality]

## Technology Stack

[Languages, frameworks, tools, services]

## Getting Started

### Prerequisites

### Installation

### Configuration

### Usage

## Architecture

[High-level system design if complex]

## Development

### Setup

### Running locally

### Testing

### Contributing

## Deployment

[If applicable]

## License

[If license file exists]
```

## Content Guidelines

- **Clarity**: Use clear, concise language accessible to new contributors
- **Completeness**: Include all essential information for setup and usage
- **Examples**: Provide code examples or command samples where helpful
- **Structure**: Use proper markdown formatting with headers, lists, and code blocks
- **Accuracy**: Base all content on actual codebase analysis, not assumptions

## Analysis Commands to Use

Start your analysis with these commands:

```bash
git ls-files
find . -name "package.json" -o -name "requirements.txt" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pom.xml" | head -10
ls -la
```

## Special Considerations

- **Monorepos**: Identify multiple projects and document accordingly
- **Infrastructure projects**: Focus on deployment and configuration aspects
- **Libraries**: Emphasize API documentation and usage examples
- **Applications**: Highlight features and user-facing functionality
- **Scripts/Tools**: Document command-line usage and parameters

## Output Format

Generate a complete README.md file that:

- Starts with a clear project title and description
- Uses proper markdown syntax throughout
- Includes relevant badges if appropriate (build status, version, license)
- Has a logical flow from overview to detailed setup instructions
- Ends with contribution guidelines or contact information if relevant

## Quality Checklist

Before finalizing, ensure the README:

- [ ] Accurately represents the actual codebase
- [ ] Provides clear setup instructions that would work for a new developer
- [ ] Uses consistent formatting and style
- [ ] Includes all major components and features discovered
- [ ] Has no placeholder text or generic examples
- [ ] Matches the complexity and scope of the actual project

## Example Analysis Flow

1. Run `git ls-files` to get complete file listing
2. Identify main programming languages from file extensions
3. Look for package managers and dependency files
4. Examine directory structure for architectural patterns
5. Check for configuration files to understand deployment/setup
6. Analyze main entry points and key source files
7. Generate comprehensive README based on findings

Begin your analysis by examining the repository structure and files, then create a README.md that would help any developer understand and work with this codebase effectively.
