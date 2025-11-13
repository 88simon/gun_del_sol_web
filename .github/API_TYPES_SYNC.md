# API Types Synchronization

This document describes the automated OpenAPI→TypeScript types synchronization system between the backend and frontend repositories.

## Overview

The Gun Del Sol project uses a FastAPI backend that automatically generates TypeScript types from its OpenAPI schema. These types are automatically synced to the frontend to ensure type safety across the full stack.

## Architecture

### Backend (solscan_hotkey)

- **Workflow:** `.github/workflows/openapi-schema.yml`
- **Generated files:**
  - `backend/openapi.json` - OpenAPI 3.0 schema
  - `backend/api-types.ts` - TypeScript types (committed to backend repo)
  - Frontend: `src/lib/generated/api-types.ts` - Auto-synced types (committed to frontend repo)

### Frontend (gun-del-sol-web)

- **Workflow:** `.github/workflows/ci.yml` (api-types-check job)
- **Script:** `scripts/sync-api-types.ts`
- **Location:** `src/lib/generated/api-types.ts`

## How It Works

### 1. Automatic Sync (Backend → Frontend)

When changes are pushed to the `main` branch of the **backend** repository:

1. **Export OpenAPI Schema** - The FastAPI app's OpenAPI schema is exported to `backend/openapi.json`
2. **Generate TypeScript Types** - Using `openapi-typescript`, generates `backend/api-types.ts`
3. **Commit to Backend** - Types are committed to the backend repository
4. **Sync to Frontend** - Types are copied to `src/lib/generated/api-types.ts` in the frontend repository
5. **Commit to Frontend** - A new commit is pushed to the frontend repository with the updated types

**Required:** The backend workflow needs a `FRONTEND_SYNC_TOKEN` secret with permissions to push to the frontend repository. If not available, it falls back to the default `github.token`.

### 2. CI Guard (Frontend)

Every PR to the **frontend** repository runs a sync check:

1. Checks out both backend and frontend repositories
2. Generates fresh TypeScript types from the backend's OpenAPI schema
3. Compares with the committed `src/lib/generated/api-types.ts`
4. **Fails the CI** if types are out of sync

This ensures the frontend always uses current types from the backend.

### 3. Manual Sync (Development)

During local development, you can manually sync types using:

```bash
# Check if types are in sync
pnpm sync-types:check

# Update types from backend
pnpm sync-types:update
```

**Requirements:**

- Backend repository must be cloned at `../solscan_hotkey` (relative to frontend root)
- Python 3.11+ with backend dependencies installed
- Node.js 20+ with pnpm

## Scripts & Commands

### Frontend Scripts

```json
{
  "sync-types": "tsx scripts/sync-api-types.ts",
  "sync-types:check": "tsx scripts/sync-api-types.ts",
  "sync-types:update": "tsx scripts/sync-api-types.ts --update"
}
```

### sync-api-types.ts

**Environment Variables:**

- `BACKEND_REPO_PATH` - Path to backend repository (default: `../solscan_hotkey`)
- `CI` - Set to `true` in CI environments

**Behavior:**

- **Check mode** (default): Validates types are in sync, exits with code 1 if not
- **Update mode** (`--update`): Regenerates and updates the committed types

## Workflow Details

### Backend: openapi-schema.yml

**Triggers:**

- Push to `main` branch
- Pull requests to `main`
- Manual workflow dispatch

**Jobs:**

1. **export-schema** - Exports OpenAPI schema, uploads artifact, comments on PRs
2. **generate-typescript** - (Only on main branch) Generates types and syncs to frontend

**Permissions:**

- `contents: write` - Required to commit generated types
- `pull-requests: write` - Required to comment on PRs

### Frontend: ci.yml

**New Job: api-types-check**

Runs in parallel with other CI jobs (lint, type-check, build).

**Steps:**

1. Checkout frontend repo to `frontend-repo/`
2. Checkout backend repo to `backend-repo/`
3. Setup Python + pnpm
4. Install dependencies for both repos
5. Create backend test config files
6. Run `pnpm sync-types:check` with custom backend path

**Dependencies:**

- Build job depends on: `[lint-format, type-check, api-types-check]`
- All checks must pass before PR can be merged

## File Structure

```
solscan_hotkey/ (backend)
├── .github/
│   └── workflows/
│       └── openapi-schema.yml    # Auto-sync workflow
├── backend/
│   ├── openapi.json              # Generated schema
│   ├── api-types.ts              # Generated types (committed)
│   └── app/
│       └── main.py               # FastAPI app

gun-del-sol-web/ (frontend)
├── .github/
│   ├── workflows/
│   │   └── ci.yml                # CI guard included
│   └── API_TYPES_SYNC.md         # This file
├── scripts/
│   └── sync-api-types.ts         # Manual sync script
└── src/
    └── lib/
        ├── generated/
        │   └── api-types.ts      # Auto-synced types (committed)
        └── api.ts                # API client using types
```

## Migration Guide

### Migrating from Manual Types

If you currently have manual TypeScript interfaces in `src/lib/api.ts`:

1. **Generate initial types:**

   ```bash
   pnpm sync-types:update
   ```

2. **Import generated types:**

   ```typescript
   // Before (manual types)
   export interface Token {
     id: number;
     token_address: string;
     // ...
   }

   // After (generated types)
   import { components } from './generated/api-types';

   export type Token = components['schemas']['Token'];
   ```

3. **Update API client:**

   - Replace manual interfaces with generated types
   - Use `paths` for request/response types
   - Use `components['schemas']` for model types

4. **Commit changes:**
   ```bash
   git add src/lib/generated/api-types.ts src/lib/api.ts
   git commit -m "feat: migrate to auto-generated API types"
   ```

### Example Usage

```typescript
import { components, paths } from './generated/api-types';

// Schema types
type Token = components['schemas']['Token'];
type TokensResponse = components['schemas']['TokensResponse'];

// Endpoint types
type GetTokensResponse =
  paths['/api/tokens/history']['get']['responses']['200']['content']['application/json'];
type GetTokenByIdParams =
  paths['/api/tokens/{id}']['get']['parameters']['path'];

// Use in API client
export async function getTokens(): Promise<TokensResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/history`);
  return res.json();
}
```

## Troubleshooting

### CI Failing: "API types are out of sync"

**Cause:** The committed types don't match the backend's current OpenAPI schema.

**Solution:**

```bash
# In frontend repo
pnpm sync-types:update
git add src/lib/generated/api-types.ts
git commit -m "chore: sync API types from backend"
git push
```

### Backend Workflow Not Syncing to Frontend

**Possible causes:**

1. Missing `FRONTEND_SYNC_TOKEN` secret → Check repository secrets
2. Token lacks push permissions → Verify token scopes
3. Frontend repo path incorrect → Check workflow checkout step

### Local Sync Script Fails

**Error: "Backend repository not found"**

- Ensure backend is cloned at `../solscan_hotkey`
- Or set `BACKEND_REPO_PATH` environment variable:
  ```bash
  BACKEND_REPO_PATH=/path/to/backend pnpm sync-types:update
  ```

**Error: "Failed to generate OpenAPI schema"**

- Ensure Python dependencies are installed:
  ```bash
  cd ../solscan_hotkey/backend
  pip install -r requirements-dev.txt
  ```

## Security Considerations

### GitHub Token Permissions

The `FRONTEND_SYNC_TOKEN` should have:

- **Scope:** `repo` (full repository access)
- **Permissions:** `contents: write`
- **Expiry:** Set appropriate expiration (90 days recommended)

### Avoiding Infinite Loops

The workflows are designed to avoid triggering each other:

- Backend workflow only runs on main branch pushes/PRs
- Frontend commits from bot don't trigger workflows (uses `github-actions[bot]` user)
- If issues occur, check workflow triggers and add `if` conditions

## Future Enhancements

Potential improvements to the system:

1. **Versioning:** Track API version in types file header
2. **Changelog:** Auto-generate API changes in PR comments
3. **Breaking Changes:** Detect breaking changes and require confirmation
4. **Validation:** Add runtime validation using zod schemas generated from OpenAPI
5. **Monitoring:** Track sync frequency and failures in dashboards

## References

- [openapi-typescript](https://github.com/drwpow/openapi-typescript) - Type generation tool
- [FastAPI OpenAPI](https://fastapi.tiangolo.com/advanced/extending-openapi/) - Backend schema generation
- [GitHub Actions Workflows](https://docs.github.com/en/actions/using-workflows) - CI/CD automation

---

**Last Updated:** November 2025
**Maintainer:** 88simon
