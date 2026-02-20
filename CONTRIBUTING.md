# Contributing to Agent Receipts

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/webaesbyamin/agent-receipts.git
cd agent-receipts

# Install dependencies
pnpm install

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
feat: description of change
fix: description of bug fix
refactor: description of refactoring
docs: description of documentation change
test: description of test change
chore: version bumps, dependency updates
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass:
   - `pnpm build` — zero errors
   - `pnpm test` — zero failures
   - `pnpm -r run typecheck` — zero TypeScript errors
4. Push your branch and open a PR
5. Describe the change and link to any relevant issues

## Implementation Rules

- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Zod validation on all inputs
- Append-only receipts — never update or delete after completion
- Raw data never leaves the client — only SHA-256 hashes
- All errors use the standard format: `{ error: { code, message, status } }`

## Project Structure

```
packages/schema      — Zod schemas and TypeScript types
packages/crypto      — Ed25519 signing, verification, key management
packages/mcp-server  — MCP server, receipt engine, storage
packages/sdk         — High-level Node.js SDK
packages/cli         — Command-line tool
apps/web             — Mission Control dashboard (Next.js)
examples/            — Usage examples
spec/                — Protocol specification
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
