# Thermal Gait Surveillance PWA

## Project Context
* This repo is for a **PWA (Progressive Web App)** and backend API to support **gait-driven concealed firearm detection using thermal video**.
* The **core model** (PyTorch autoencoder, trained on OU-MVLP + adapted on UCLM thermal dataset) lives in a **separate repo**. Here, we focus on:
   * **Authentication** (Sprint 1: secure user login + 2FA)
   * **CRUD/API integration**
   * **Job submission & inference orchestration**
   * **Analytics, reporting, and export features**

## Workflow & Repo Etiquette
* Branch naming: `feature/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`.
* Use **PRs into** `development`, then merge `development → main` via PR only (no direct pushes).
* Prefer **rebase before merge** to keep history linear, unless otherwise noted in sprint docs.
* Run **tests & linter before commit**. CI enforces this.

## Environment Setup
* Python: 3.10+ (use `pyenv` if needed).
* Node: 18+ (for frontend).
* Docker & Docker Compose required.
* Postgres 16 runs via docker-compose.
* Run stack with:

```bash
make up       # start services
make migrate  # run DB migrations
make seed     # seed initial admin user
make down     # stop + remove
```

## Bash Commands
* `make up`: Build & start PWA + API + DB stack.
* `make down`: Stop stack.
* `make migrate`: Apply Alembic migrations.
* `make seed`: Seed initial DB records (admin).
* `make test`: Run unit tests.
* `make test-e2e`: Run TestSprite end-to-end flows.

## Code Style
* Backend: Python **FastAPI**, SQLAlchemy ORM, Alembic migrations.
* Frontend: Next.js (React, TypeScript, Tailwind).
* Use **ES Modules** (`import/export`) not CommonJS.
* Destructure imports when possible:

```javascript
import { useState } from "react";
```

* Security defaults:
   * Passwords: `bcrypt` hash.
   * 2FA: `pyotp` TOTP (RFC 6238).
   * Cookies: `HttpOnly`, `SameSite=Strict`, `Secure` (except for local dev).
   * Never store tokens in `localStorage`.

## Testing Instructions
* Unit tests: Pytest for backend, Jest for frontend.
* Integration tests: Hitting `/auth/*` endpoints with valid/invalid flows.
* End-to-end tests: **TestSprite MCP** with scenarios in `testsprite/auth-flows.yaml`:
   * Signup → Login → Setup TOTP → Verify → Fetch `/auth/me`.
   * Invalid TOTP attempt.
   * Rate-limit enforcement.
* Run locally:

```bash
make test-e2e
```

## Documentation
* `/docs/README.md`: Setup guide.
* `/docs/API.md`: Auth endpoints.
* `/docs/OOAD`: Contains diagrams (Use Case, Sequence, ERD, Context, System Architecture).
* `/docs/SECURITY.md`: Policies + known caveats.

## Known Warnings / Quirks
* For local dev, disable `Secure` cookie flag if using `http://localhost`.
* CLAHE preprocessing is only relevant in the **model repo**, not this PWA repo.
* The **model service** is external (HTTP API). Treat it as a black-box dependency.
