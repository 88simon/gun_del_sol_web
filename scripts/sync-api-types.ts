#!/usr/bin/env node
/**
 * Sync API Types from Backend
 *
 * This script fetches the OpenAPI schema from the backend repository,
 * generates TypeScript types, and compares them with the committed types.
 *
 * Usage:
 *   pnpm sync-types          # Check if types are in sync
 *   pnpm sync-types --update # Update types from backend
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const BACKEND_REPO_PATH = process.env.BACKEND_REPO_PATH || '../solscan_hotkey';
const BACKEND_OPENAPI_PATH = join(BACKEND_REPO_PATH, 'backend', 'openapi.json');
const FRONTEND_TYPES_PATH = join(
  process.cwd(),
  'src',
  'lib',
  'generated',
  'api-types.ts'
);
const TEMP_TYPES_PATH = join(process.cwd(), '.tmp-api-types.ts');

const shouldUpdate = process.argv.includes('--update');
const isCI = process.env.CI === 'true';

function log(message: string) {
  console.log(`[sync-api-types] ${message}`);
}

function error(message: string) {
  console.error(`[sync-api-types] ❌ ${message}`);
}

function success(message: string) {
  console.log(`[sync-api-types] ✅ ${message}`);
}

function executeCommand(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
  } catch (err: any) {
    throw new Error(`Command failed: ${command}\n${err.message}`);
  }
}

function checkBackendRepo(): boolean {
  if (!existsSync(BACKEND_REPO_PATH)) {
    error(`Backend repository not found at ${BACKEND_REPO_PATH}`);
    error('Make sure the backend repo is cloned at the expected location.');
    return false;
  }
  log(`Found backend repo at ${BACKEND_REPO_PATH}`);
  return true;
}

function generateOpenAPISchema() {
  log('Generating OpenAPI schema from backend...');

  const pythonScript = `
import sys
import json
import io
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

# Suppress FastAPI startup logs by redirecting stdout
old_stdout = sys.stdout
sys.stdout = io.StringIO()

from app.main import app

# Restore stdout
sys.stdout = old_stdout

schema = app.openapi()

with open('openapi.json', 'w') as f:
    json.dump(schema, f, indent=2)

print('OpenAPI schema exported successfully!')
`;

  const configPath = join(BACKEND_REPO_PATH, 'backend', 'config.json');
  const settingsPath = join(BACKEND_REPO_PATH, 'backend', 'api_settings.json');
  const monitoredPath = join(
    BACKEND_REPO_PATH,
    'backend',
    'monitored_addresses.json'
  );

  // Create test config files if they don't exist
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({ helius_api_key: 'test-key' }));
  }
  if (!existsSync(settingsPath)) {
    writeFileSync(
      settingsPath,
      JSON.stringify({ walletCount: 5, concurrentAnalysis: 3 })
    );
  }
  if (!existsSync(monitoredPath)) {
    writeFileSync(monitoredPath, JSON.stringify([]));
  }

  try {
    executeCommand(
      `python -c "${pythonScript.replace(/"/g, '\\"')}"`,
      join(BACKEND_REPO_PATH, 'backend')
    );
    success('OpenAPI schema generated');
  } catch (err: any) {
    error(`Failed to generate OpenAPI schema: ${err.message}`);
    throw err;
  }
}

function generateTypeScriptTypes() {
  log('Generating TypeScript types from OpenAPI schema...');

  try {
    // Check if openapi-typescript is installed
    try {
      executeCommand('npx openapi-typescript --version');
    } catch {
      log('Installing openapi-typescript...');
      executeCommand('npm install -g openapi-typescript');
    }

    executeCommand(
      `npx openapi-typescript ${BACKEND_OPENAPI_PATH} -o ${TEMP_TYPES_PATH}`
    );

    // Format the generated types with prettier to match project style
    log('Formatting generated types...');
    executeCommand(`npx prettier --write ${TEMP_TYPES_PATH}`);

    success('TypeScript types generated');
  } catch (err: any) {
    error(`Failed to generate TypeScript types: ${err.message}`);
    throw err;
  }
}

function compareTypes(): boolean {
  if (!existsSync(FRONTEND_TYPES_PATH)) {
    log('No existing types found in frontend');
    return false;
  }

  const existingTypes = readFileSync(FRONTEND_TYPES_PATH, 'utf-8');
  const newTypes = readFileSync(TEMP_TYPES_PATH, 'utf-8');

  return existingTypes === newTypes;
}

function updateTypes() {
  log('Updating frontend types...');

  // Ensure directory exists
  const dir = dirname(FRONTEND_TYPES_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const newTypes = readFileSync(TEMP_TYPES_PATH, 'utf-8');
  writeFileSync(FRONTEND_TYPES_PATH, newTypes);

  // Clean up temp file
  if (existsSync(TEMP_TYPES_PATH)) {
    executeCommand(`rm ${TEMP_TYPES_PATH}`);
  }

  success(`Types updated at ${FRONTEND_TYPES_PATH}`);
}

function main() {
  log('Starting API types sync...');
  log(`Mode: ${shouldUpdate ? 'UPDATE' : 'CHECK'}`);

  try {
    // Step 1: Check backend repo exists
    if (!checkBackendRepo()) {
      process.exit(1);
    }

    // Step 2: Generate OpenAPI schema from backend
    generateOpenAPISchema();

    // Step 3: Generate TypeScript types
    generateTypeScriptTypes();

    // Step 4: Compare or update
    if (shouldUpdate) {
      updateTypes();
      success('API types sync completed successfully!');
      success('Remember to commit the updated types.');
    } else {
      const inSync = compareTypes();

      if (inSync) {
        success('API types are in sync with backend! ✨');
      } else {
        error('API types are out of sync with backend!');
        error('');
        error('To update the types, run:');
        error('  pnpm sync-types --update');
        error('');

        if (isCI) {
          error(
            'In CI: Types must be kept in sync. Please update and commit them.'
          );
        }

        process.exit(1);
      }
    }
  } catch (err: any) {
    error(`Sync failed: ${err.message}`);
    process.exit(1);
  }
}

main();
