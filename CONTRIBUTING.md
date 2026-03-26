# Contributing to MyGang.ai

Thanks for your interest in contributing to MyGang.ai! We welcome bug reports, feature suggestions, and code contributions from the community.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [pnpm](https://pnpm.io/) (we do **not** use npm or yarn)

### Development Setup

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/mygang-2.git
   cd mygang-2
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy the example environment file and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

## Code Style

- **TypeScript** in strict mode for all source files.
- **Functional React components** with hooks — no class components.
- **Tailwind CSS** for styling. Avoid inline styles or CSS modules.
- Keep code simple and clean. No over-engineering.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix    | Usage                          |
| --------- | ------------------------------ |
| `feat:`   | A new feature                  |
| `fix:`    | A bug fix                      |
| `chore:`  | Maintenance, deps, tooling     |
| `docs:`   | Documentation changes          |
| `style:`  | Formatting (no code change)    |
| `refactor:` | Code restructuring           |
| `test:`   | Adding or updating tests       |
| `perf:`   | Performance improvements       |

Keep messages short and descriptive:
```
feat: add dark mode toggle to settings
fix: prevent duplicate webhook processing
```

## Pull Request Process

1. **Fork** the repo and create a feature branch from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes, commit with conventional commit messages.

3. Push to your fork and **open a Pull Request** against `master`.

4. In your PR description, include:
   - What the change does and why
   - Screenshots or recordings for UI changes
   - Any breaking changes

5. A maintainer will review your PR. Please be patient — we may request changes.

## Reporting Issues

- Use the [bug report template](https://github.com/WarriorSushi/mygang-2/issues/new?template=bug_report.yml) for bugs.
- Use the [feature request template](https://github.com/WarriorSushi/mygang-2/issues/new?template=feature_request.yml) for ideas.
- Search existing issues before opening a new one.
- Provide as much detail as possible — steps to reproduce, screenshots, environment info.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to security@mygang.ai.

## License

By contributing, you agree that your contributions will be licensed under the project's [Business Source License 1.1](LICENSE).
