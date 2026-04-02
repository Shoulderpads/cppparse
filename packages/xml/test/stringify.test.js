import { describe, it, expect } from 'vitest';
import { parse, stringify } from '../lib/index.mjs';

describe('stringify', () => {
  it('stringifies a simple element', () => {
    const xml = stringify({ name: 'Alice' });
    expect(xml).toContain('<name>Alice</name>');
  });

  it('stringifies nested elements', () => {
    const xml = stringify({ a: { b: { c: '1' } } });
    expect(xml).toContain('<c>1</c>');
    expect(xml).toContain('<b>');
    expect(xml).toContain('<a>');
  });

  it('stringifies attributes from @_ keys', () => {
    const xml = stringify({ book: { '@_id': '1', '#text': 'hello' } });
    expect(xml).toContain('id="1"');
    expect(xml).toContain('hello');
  });

  it('stringifies arrays as repeated elements', () => {
    const xml = stringify({ root: { item: ['A', 'B', 'C'] } });
    expect(xml).toContain('<item>A</item>');
    expect(xml).toContain('<item>B</item>');
    expect(xml).toContain('<item>C</item>');
  });

  it('stringifies XML declaration from ?xml key', () => {
    const xml = stringify({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      root: 'hello',
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<root>hello</root>');
  });

  it('stringifies numbers and booleans as text', () => {
    const xml = stringify({ root: { count: '42', active: 'true' } });
    expect(xml).toContain('<count>42</count>');
    expect(xml).toContain('<active>true</active>');
  });

  it('stringifies empty elements', () => {
    const xml = stringify({ root: { empty: '' } });
    // pugixml may render as <empty /> or <empty></empty>
    expect(xml).toMatch(/<empty\s*\/?>|<empty><\/empty>/);
  });

  it('round-trips a complex document', () => {
    const original = {
      config: {
        '@_version': '2.0',
        server: {
          '@_host': 'localhost',
          '@_port': '8080',
          ssl: 'true',
        },
        users: {
          user: [
            { '@_id': '1', name: 'Alice' },
            { '@_id': '2', name: 'Bob' },
          ],
        },
      },
    };
    const xml = stringify(original);
    const parsed = parse(xml);
    expect(parsed.config['@_version']).toBe('2.0');
    expect(parsed.config.server['@_host']).toBe('localhost');
    expect(parsed.config.users.user).toHaveLength(2);
    expect(parsed.config.users.user[0].name).toBe('Alice');
  });

  it('throws on non-object input', () => {
    expect(() => stringify('hello')).toThrow();
    expect(() => stringify(null)).toThrow();
  });
});
