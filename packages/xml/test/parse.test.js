import { describe, it, expect } from 'vitest';
import { parse } from '../lib/index.mjs';

describe('parse', () => {
  it('parses a simple element', () => {
    expect(parse('<name>Alice</name>')).toEqual({ name: 'Alice' });
  });

  it('parses nested elements', () => {
    expect(parse('<a><b><c>1</c></b></a>')).toEqual({
      a: { b: { c: '1' } },
    });
  });

  it('parses attributes with @_ prefix', () => {
    expect(parse('<book id="1" lang="en">text</book>')).toEqual({
      book: { '@_id': '1', '@_lang': 'en', '#text': 'text' },
    });
  });

  it('collapses pure text leaves (no attributes)', () => {
    expect(parse('<root><name>Alice</name></root>')).toEqual({
      root: { name: 'Alice' },
    });
  });

  it('parses repeated elements as arrays', () => {
    const xml = '<root><item>A</item><item>B</item><item>C</item></root>';
    expect(parse(xml)).toEqual({
      root: { item: ['A', 'B', 'C'] },
    });
  });

  it('parses repeated complex elements as arrays', () => {
    const xml = '<root><user id="1">Alice</user><user id="2">Bob</user></root>';
    expect(parse(xml)).toEqual({
      root: {
        user: [
          { '@_id': '1', '#text': 'Alice' },
          { '@_id': '2', '#text': 'Bob' },
        ],
      },
    });
  });

  it('parses self-closing elements as empty strings', () => {
    expect(parse('<root><empty/></root>')).toEqual({
      root: { empty: '' },
    });
  });

  it('parses XML declaration', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><root>hello</root>';
    expect(parse(xml)).toEqual({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      root: 'hello',
    });
  });

  it('parses CDATA sections as text', () => {
    expect(parse('<data><![CDATA[<html>]]></data>')).toEqual({
      data: '<html>',
    });
  });

  it('parses mixed attributes and children', () => {
    const xml = '<server host="localhost" port="8080"><ssl>true</ssl></server>';
    expect(parse(xml)).toEqual({
      server: {
        '@_host': 'localhost',
        '@_port': '8080',
        ssl: 'true',
      },
    });
  });

  it('handles text alongside children as #text', () => {
    const xml = '<p>Hello <b>world</b></p>';
    const result = parse(xml);
    expect(result.p['#text']).toBe('Hello ');
    expect(result.p.b).toBe('world');
  });

  it('throws on invalid XML', () => {
    expect(() => parse('<unclosed>')).toThrow();
  });

  it('throws on non-string input', () => {
    expect(() => parse()).toThrow();
  });

  it('coerces non-string input to string', () => {
    // Numeric input gets coerced to string then parsed
    expect(() => parse(12345)).toThrow(); // "12345" is not valid XML
  });
});
