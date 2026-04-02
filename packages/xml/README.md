# @cppparse/xml

XML parser and serializer for Node.js backed by [pugixml](https://github.com/zeux/pugixml). Binds directly to C++ via N-API for better throughput than pure-JS alternatives.

## Install

```bash
npm install @cppparse/xml
```

Prebuilt binaries ship for macOS (arm64), Linux (arm64, x64), and Windows (x64). Falls back to compiling from source if no prebuild matches (needs a C++17 toolchain).

## Usage

```js
import { parse, stringify } from '@cppparse/xml';

const doc = parse(`
<config version="2.0">
  <server host="localhost" port="8080">
    <ssl>true</ssl>
  </server>
  <users>
    <user id="1">Alice</user>
    <user id="2">Bob</user>
  </users>
</config>
`);

console.log(doc.config['@_version']);        // "2.0"
console.log(doc.config.server['@_host']);     // "localhost"
console.log(doc.config.users.user[0]);       // { "@_id": "1", "#text": "Alice" }

console.log(stringify(doc));
```

Also works with `require`:

```js
const { parse, stringify } = require('@cppparse/xml');
```

## Conventions

Follows the same conventions as [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser):

- **Attributes** use `@_` prefix: `<el id="1">` → `{ "@_id": "1" }`
- **Text content** uses `#text` when mixed with attributes or children: `<el id="1">text</el>` → `{ "@_id": "1", "#text": "text" }`
- **Pure text elements** collapse to strings: `<name>Alice</name>` → `"Alice"`
- **Repeated elements** become arrays: `<item>A</item><item>B</item>` → `["A", "B"]`
- **XML declarations** use `?xml` key: `<?xml version="1.0"?>` → `{ "?xml": { "@_version": "1.0" } }`
- **CDATA** is treated as text

## API

### `parse(text: string): unknown`

Parses an XML string and returns the corresponding JS object. Throws on invalid input.

### `stringify(value: unknown): string`

Converts a JS object to an XML string. Keys with `@_` prefix become attributes, `#text` becomes text content, arrays produce repeated elements.

## Performance

Parse benchmarks against [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser) 4.x on Node 22 (Apple M-series):

| Workload | ops/s | vs fast-xml-parser |
|---|---|---|
| Small config (4 keys) | 788K | 3.3x |
| Medium mapping (50 items) | 17.1K | 3.8x |
| Large sequence (500 items) | 1.7K | 4.1x |
| Realistic config | 116K | 2.4x |

```bash
npm run bench   # run locally
```

## Limitations

- No streaming/SAX-style parsing.
- No XPath queries (yet).
- No schema validation.
- All values are strings — no automatic type coercion (XML has no native type system).

## Requirements

Node.js >= 18. Source builds need a C++17 compiler and Python 3.

## License

MIT. pugixml is also [MIT licensed](https://github.com/zeux/pugixml/blob/master/LICENSE.md).
