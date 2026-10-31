# Security policy

Agent Receipts is a signing and verification tool, so security reports are taken seriously and answered quickly.

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Instead, either:

- use GitHub's **Report a vulnerability** button on the Security tab of this repository (private), or
- email **hello@webaes.com** with "Agent Receipts security" in the subject.

Include what you found, how to reproduce it, and which package and version are affected. You'll get a reply within 3 working days, and a fix or a plan within 14 days for confirmed issues. If you'd like credit in the release notes, say so.

## In scope

- Forging, altering or replaying a receipt so that it still verifies
- Getting a receipt signed by one key to show as signed by another (including on a branded verify page)
- Downgrade attacks (an old-format receipt passing as fully verified)
- Hiding or rewriting history in a receipt chain without `verify-chain` noticing
- Escaping the Magic Folder job sandbox (reading or writing outside the job folder, running commands)
- Leaking a signing key, or anything in a package or page that sends data somewhere it says it doesn't

## Supported versions

Fixes go into the latest release of each package. Please upgrade before reporting.

| Package | Supported |
| --- | --- |
| `@agent-receipts/mcp-server`, `sdk`, `cli`, `dashboard` | 0.5.x |
| `@agent-receipts/schema`, `crypto` | 0.5.x |
| `@agent-receipts/magic-folder` | 0.1.x (latest) |

Versions below 0.5.0 sign only 12 core fields (format v1) and aren't supported.
