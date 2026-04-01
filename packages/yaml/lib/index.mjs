import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const binding = require('node-gyp-build')(join(__dirname, '..'));

export function parse(text) {
  return binding.parse(String(text));
}

export function stringify(value) {
  return binding.stringify(value);
}
