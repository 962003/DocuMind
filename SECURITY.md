# Security Policy

## Supported versions

DocuMind is under active development. Security fixes are applied to the latest `main` branch.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| older commits   | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately so the issue can be addressed before public disclosure:

1. Use GitHub's [**Private vulnerability reporting**](https://github.com/962003/DocuMind/security/advisories/new) (Security tab → "Report a vulnerability"), **or**
2. Open a minimal issue asking a maintainer for a private contact channel — without disclosing details.

Please include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce (proof of concept if possible).
- Affected components or endpoints.
- Any suggested remediation.

## What to expect

- **Acknowledgement** of your report as soon as it is reviewed.
- An assessment of severity and a remediation plan.
- Coordinated disclosure once a fix is available — credit will be given to reporters who wish to be named.

## Scope & hardening

DocuMind already includes several security controls (JWT auth with per-user data isolation, input validation, secure file-upload checks, rate limiting, bcrypt password hashing, and prompt-injection mitigation). When deploying:

- Always set a strong, unique `JWT_SECRET` — **never** use the default.
- Keep all API keys and database credentials in environment variables; never commit `.env`.
- Run behind HTTPS and restrict `ALLOWED_ORIGINS` to trusted frontends.

Thank you for helping keep DocuMind and its users safe.
