# @cppparse/yaml

YAML parser and serializer for Node.js backed by [rapidyaml](https://github.com/biojppm/rapidyaml). Binds directly to C++ via N-API for better throughput than pure-JS alternatives.

## Install

```bash
npm install @cppparse/yaml
```

Prebuilt binaries ship for macOS (arm64), Linux (arm64, x64), and Windows (x64). Falls back to compiling from source if no prebuild matches (needs a C++17 toolchain).

## Usage

```js
import { parse, stringify } from '@cppparse/yaml';

const config = parse(`
server:
  host: localhost
  port: 8080
  ssl: true
database:
  pool: { min: 5, max: 20 }
`);

console.log(config.server.port); // 8080

console.log(stringify({ name: 'Alice', tags: ['admin', 'dev'] }));
```

Also works with `require`:

```js
const { parse, stringify } = require('@cppparse/yaml');
```

## API

### `parse(text: string): unknown`

Parses a YAML string and returns the corresponding JS value. Supports block and flow styles, anchors/aliases, merge keys, multi-line scalars (`|`, `>`), and standard type coercion for unquoted values (booleans, numbers, null, `.inf`, `.nan`). Quoted scalars always come back as strings. Throws on invalid input.

### `stringify(value: unknown): string`

Converts a JS value to a YAML string. Strings are double-quoted; numbers, booleans, and null are unquoted.

## Performance

Parse benchmarks against [js-yaml](https://www.npmjs.com/package/js-yaml) 4.x on Node 22 (Apple M-series):

| Workload | ops/s | vs js-yaml |
|---|---|---|
| Small config (4 keys) | 712K | 1.4x |
| Medium mapping (50 keys) | 17.8K | 1.9x |
| Large sequence (500 items) | 1.7K | 1.9x |
| Realistic config | 113K | 1.5x |

```bash
npm run bench   # run locally
```

## Limitations

- No multi-document streams (`loadAll` equivalent).
- No custom schemas or type constructors.
- rapidyaml targets practical YAML coverage, not 100% of the YAML Test Suite. Exotic edge cases (complex mapping keys, some unusual quoting) may not parse correctly.

## Requirements

Node.js >= 18. Source builds need a C++17 compiler and Python 3.

## License

MIT. rapidyaml is also [MIT licensed](https://github.com/biojppm/rapidyaml/blob/master/LICENSE.txt).
