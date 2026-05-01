# Contributing to oggo

First off, thank you for considering contributing to Oggo. It's people like you that make the open-source community such a great place to learn, inspire, and create.

## 1. Setup

Our stack is heavily based on Node.js, Express, SQLite, and Vanilla JS/Tailwind on the frontend.

1.  **Fork and clone** the repository.
2.  Ensure you have **Node.js 22+** installed.
3.  Run `npm install` to install dependencies.
4.  Copy `.env.example` to `.env` and adjust variables if needed.
5.  Start the development server with `npm run dev` or `npm start`.

If you touch code structure or cross-module dependencies, update the graph index:

```bash
graphify update .
```

## 2. Branch Naming

Please use descriptive branch names:
-   `feat/your-feature-name`
-   `fix/issue-description`
-   `docs/update-readme`
-   `refactor/component-name`

## 3. Commit Style

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
-   `feat: add SSH terminal support`
-   `fix: resolve SQLite locking issue`
-   `docs: update installation guide`
-   `chore: update dependencies`

## 4. Scope of Good PRs

- Small, focused, and reviewable changes.
- Clear problem statement in PR description.
- Backward-compatible behavior unless explicitly noted.
- UI changes should include screenshots or short recordings.
- Security-sensitive code must include risk notes.

## 5. Pull Request Process

1.  Ensure your code adheres to the project's styling and linting rules.
2.  Update the `README.md` or documentation in `docs/` with details of changes, if applicable.
3.  Fill out the Pull Request template completely.
4.  Once opened, your PR will trigger GitHub Actions CI. Ensure all checks pass.
5.  A maintainer will review your PR. We may request changes or approve it directly.

## 6. Testing

We rely on automated and manual testing.
-   Ensure you test your changes locally across different environments (Windows/Linux/macOS) if they interact with the filesystem or terminal processes.
-   If you add a new feature, please provide a clear way to verify it works in your PR description.

## 6. Code Style

-   **Backend (Node.js):** Use standard CommonJS or ES modules as consistent with the current files. Follow Prettier/ESLint configurations if present.
-   **Frontend:** We use Vanilla JS and Tailwind CSS. Keep DOM manipulation clean and use `data-*` attributes for state where appropriate.
-   **General:** Keep functions small, document complex logic, and avoid deeply nested callbacks.

## 7. Documentation and Comments

- Add or update docs when behavior changes.
- Add comments where logic is non-obvious (especially parsing, security, terminal streams).
- Avoid obvious comments that repeat code.

## 8. Security Reporting

If you find a security vulnerability, **do not open a public issue**. Please refer to our [SECURITY.md](SECURITY.md) for instructions on reporting it privately.

## 9. License Note

By contributing to Oggo, you agree that your contributions are licensed under the Business Source License 1.1 (BUSL-1.1) used by this repository. You waive claims to separate royalties for your contribution in the combined project.
