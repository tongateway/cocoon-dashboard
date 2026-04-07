// Simple file-based persistent store
// Data survives server restarts

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Ensure data directory exists
try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function filePath(name) {
  return join(DATA_DIR, name + '.json');
}

export function load(name, fallback = null) {
  try {
    const raw = readFileSync(filePath(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(name, data) {
  try {
    writeFileSync(filePath(name), JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn(`[store] Failed to save ${name}:`, e.message);
  }
}
