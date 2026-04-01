import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const binding = require('node-gyp-build')(join(__dirname, '..'));

import jsYaml from 'js-yaml';

// payloads START ******************************************************************

const SMALL_YAML = `
name: Alice
age: 30
active: true
score: 99.5
`;

const MEDIUM_YAML = (() => {
  const lines = [];
  for (let i = 0; i < 50; i++) {
    lines.push(`key${i}:`);
    lines.push(`  id: ${i}`);
    lines.push(`  value: "item-${i}"`);
    lines.push(`  count: ${(i * 3.14).toFixed(2)}`);
    lines.push(`  enabled: ${i % 2 === 0}`);
  }
  return lines.join('\n');
})();

const LARGE_YAML = (() => {
  const lines = ['users:'];
  for (let i = 0; i < 500; i++) {
    lines.push(`  - id: ${i}`);
    lines.push(`    name: "user-${i}"`);
    lines.push(`    email: "user${i}@example.com"`);
    lines.push(`    age: ${20 + (i % 50)}`);
    lines.push(`    active: ${i % 3 !== 0}`);
  }
  return lines.join('\n');
})();

const CONFIG_YAML = `
server:
  host: localhost
  port: 8080
  ssl:
    enabled: true
    cert: "/etc/ssl/cert.pem"
    key: "/etc/ssl/key.pem"
database:
  driver: postgres
  host: db.example.com
  port: 5432
  name: myapp
  pool:
    min: 5
    max: 20
    idle_timeout: 30000
logging:
  level: info
  format: json
  outputs:
    - type: file
      path: "/var/log/app.log"
    - type: stdout
features:
  - name: dark_mode
    enabled: true
    rollout: 0.5
  - name: new_dashboard
    enabled: false
    rollout: 0.0
`;

const SMALL_OBJ = { name: 'Alice', age: 30, active: true, score: 99.5 };

const MEDIUM_OBJ = (() => {
  const obj = {};
  for (let i = 0; i < 50; i++) {
    obj[`key${i}`] = { id: i, value: `item-${i}`, count: i * 3.14, enabled: i % 2 === 0 };
  }
  return obj;
})();

// payloads END ********************************************************************

// runner START ********************************************************************

function bench(fn, iterations = 50_000) {
  for (let i = 0; i < Math.min(1000, iterations / 10); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return Math.round(iterations / ((performance.now() - start) / 1000));
}

function fmt(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function compare(label, ours, theirs) {
  const ratio = ours / theirs;
  const color = ratio >= 1 ? '\x1b[32m' : '\x1b[31m';
  const x = ratio >= 1 ? ratio.toFixed(2) : (1 / ratio).toFixed(2);
  const dir = ratio >= 1 ? 'faster' : 'slower';
  console.log(`  ${label}`);
  console.log(`    ours:    ${fmt(ours).padStart(8)} ops/s`);
  console.log(`    js-yaml: ${fmt(theirs).padStart(8)} ops/s  ${color}${x}x ${dir}\x1b[0m`);
}

// runner END **********************************************************************

// run START ***********************************************************************

console.log(`\n@cppparse/yaml benchmark\n${'='.repeat(50)}`);

console.log('\nparse:');
for (const [label, yaml, iters] of [
  ['small (4 keys)',       SMALL_YAML,  200_000],
  ['medium (50 keys)',     MEDIUM_YAML, 20_000],
  ['large (500 items)',    LARGE_YAML,  1_000],
  ['realistic config',    CONFIG_YAML, 100_000],
]) {
  compare(label,
    bench(() => binding.parse(yaml), iters),
    bench(() => jsYaml.load(yaml), iters),
  );
}

console.log('\nstringify:');
for (const [label, obj, iters] of [
  ['small (4 keys)',   SMALL_OBJ,  200_000],
  ['medium (50 keys)', MEDIUM_OBJ, 20_000],
]) {
  compare(label,
    bench(() => binding.stringify(obj), iters),
    bench(() => jsYaml.dump(obj), iters),
  );
}

console.log(`\n${'='.repeat(50)}`);
console.log(`node ${process.version} | ${process.arch}\n`);

// run END *************************************************************************