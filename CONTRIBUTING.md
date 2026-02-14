# Contributing to Agent Receipts

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Supabase project (for database)

### Setup

```bash
# Clone the repository
git clone https://github.com/webaesbyamin/agent-receipts.git
cd agent-receipts

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Fill in your Supabase credentials and generate signing keys
# See .env.example for details

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev
```

## Branch Naming

Use the following format:

```
feat/short-description     # New features
fix/short-description      # Bug fixes
refactor/short-description # Code refactoring
docs/short-description     # Documentation changes
test/short-description     # Test additions/changes
```

## Commit Messages

Follow this format:

```
feat: description of change — Phase N
fix: description of bug fix
refactor: description of refactoring
docs: description of documentation change
test: description of test change
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the implementation rules in the blueprint
3. Ensure all checks pass:
   - `pnpm build` — zero errors
   - `pnpm test` — zero failures
   - `pnpm typecheck` — zero TypeScript errors
4. Push your branch and open a PR
5. Describe the change and link to any relevant issues

## Implementation Rules

- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Zod validation on all API inputs
- Append-only receipts — never update or delete after completion
- Raw data never leaves the client — only SHA-256 hashes
- API keys are hashed with SHA-256, never stored raw
- All errors use the standard format: `{ error: { code, message, status } }`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
