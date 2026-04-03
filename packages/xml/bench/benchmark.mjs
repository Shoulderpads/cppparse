import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const binding = require('node-gyp-build')(join(__dirname, '..'));

import { XMLParser, XMLBuilder } from 'fast-xml-parser';
const fxpParser = new XMLParser({ ignoreAttributes: false });
const fxpBuilder = new XMLBuilder({ ignoreAttributes: false, format: true });

// payloads START ******************************************************************

const SMALL_XML = `<config>
  <name>MyApp</name>
  <version>1.0</version>
  <debug>true</debug>
  <port>8080</port>
</config>`;

const MEDIUM_XML = (() => {
  const items = [];
  for (let i = 0; i < 50; i++) {
    items.push(`  <item id="${i}" enabled="${i % 2 === 0}">
    <name>item-${i}</name>
    <value>${(i * 3.14).toFixed(2)}</value>
    <category>cat-${i % 5}</category>
  </item>`);
  }
  return `<root>\n${items.join('\n')}\n</root>`;
})();

const LARGE_XML = (() => {
  const users = [];
  for (let i = 0; i < 500; i++) {
    users.push(`  <user id="${i}" active="${i % 3 !== 0}">
    <name>user-${i}</name>
    <email>user${i}@example.com</email>
    <age>${20 + (i % 50)}</age>
  </user>`);
  }
  return `<users>\n${users.join('\n')}\n</users>`;
})();

const CONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<application>
  <server host="localhost" port="8080">
    <ssl enabled="true">
      <cert>/etc/ssl/cert.pem</cert>
      <key>/etc/ssl/key.pem</key>
    </ssl>
  </server>
  <database driver="postgres" host="db.example.com" port="5432">
    <name>myapp</name>
    <pool min="5" max="20" idle_timeout="30000"/>
  </database>
  <logging level="info" format="json">
    <output type="file" path="/var/log/app.log"/>
    <output type="stdout"/>
  </logging>
  <features>
    <feature name="dark_mode" enabled="true" rollout="0.5"/>
    <feature name="new_dashboard" enabled="false" rollout="0.0"/>
  </features>
</application>`;

const SMALL_OBJ = {
  config: {
    name: 'MyApp',
    version: '1.0',
    debug: 'true',
    port: '8080',
  },
};

const MEDIUM_OBJ = (() => {
  const items = [];
  for (let i = 0; i < 50; i++) {
    items.push({
      '@_id': String(i),
      '@_enabled': String(i % 2 === 0),
      name: `item-${i}`,
      value: (i * 3.14).toFixed(2),
      category: `cat-${i % 5}`,
    });
  }
  return { root: { item: items } };
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
  console.log(`    ours:            ${fmt(ours).padStart(8)} ops/s`);
  console.log(`    fast-xml-parser: ${fmt(theirs).padStart(8)} ops/s  ${color}${x}x ${dir}\x1b[0m`);
}

// runner END **********************************************************************

// run START ***********************************************************************

console.log(`\n@cppparse/xml benchmark\n${'='.repeat(50)}`);

console.log('\nparse:');
for (const [label, xml, iters] of [
  ['small (4 keys)',       SMALL_XML,  200_000],
  ['medium (50 items)',    MEDIUM_XML, 20_000],
  ['large (500 items)',    LARGE_XML,  1_000],
  ['realistic config',    CONFIG_XML, 100_000],
]) {
  compare(label,
    bench(() => binding.parse(xml), iters),
    bench(() => fxpParser.parse(xml), iters),
  );
}

console.log('\nstringify:');
for (const [label, obj, iters] of [
  ['small (4 keys)',   SMALL_OBJ,  200_000],
  ['medium (50 items)', MEDIUM_OBJ, 20_000],
]) {
  compare(label,
    bench(() => binding.stringify(obj), iters),
    bench(() => fxpBuilder.build(obj), iters),
  );
}

console.log(`\n${'='.repeat(50)}`);
console.log(`node ${process.version} | ${process.arch}\n`);

// run END *************************************************************************
