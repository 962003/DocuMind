# Contributing to DocuMind

Thanks for your interest in improving DocuMind! Contributions of all kinds are welcome — bug reports, feature ideas, documentation, and code.

## Getting started

1. **Fork** the repository and **clone** your fork.
2. Set up the project (see the [Deployment Guide](README.md#-deployment-guide) in the README — Docker Compose is the fastest path).
3. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

## Development workflow

### Backend (`rag-backend/`)
```bash
cd rag-backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # http://127.0.0.1:8000/docs
pytest tests/ -v                  # run the test suite
```

### Frontend (`rag-ui/`)
```bash
cd rag-ui
npm install
npm run dev                       # http://localhost:3000
```

## Making a change

- Keep changes focused — one logical change per pull request.
- **Match the surrounding code style** (naming, formatting, structure).
- Add or update tests for any behavior you change. The CI pipeline runs `pytest` and a lint check on every push, and PRs must pass before merge.
- Update the README/docs if your change affects setup, APIs, or behavior.

## Commit messages

Write clear, descriptive commit messages explaining **what** changed and **why**:
```
Add OCR fallback for scanned PDFs

Image-only PDFs produced empty chunks. Route them through an OCR
extractor before chunking so they index correctly.
```

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Describe the change, the motivation, and how you tested it.
3. Link any related issues.
4. Ensure CI is green.

## Reporting bugs & requesting features

Open a [GitHub Issue](https://github.com/962003/DocuMind/issues) with:
- **Bugs:** steps to reproduce, expected vs. actual behavior, and environment details.
- **Features:** the problem you're trying to solve and your proposed approach.

For security issues, **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
