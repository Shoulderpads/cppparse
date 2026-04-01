import { describe, it, expect } from 'vitest';
import { parse } from '../lib/index.mjs';

describe('yaml parse', () => {
  it('parses simple mapping', () => {
    expect(parse('name: Alice\nage: 30')).toEqual({ name: 'Alice', age: 30 });
  });

  it('parses nested mapping', () => {
    const yaml = `
person:
  name: Alice
  address:
    city: NYC
    zip: "10001"
`;
    expect(parse(yaml)).toEqual({
      person: { name: 'Alice', address: { city: 'NYC', zip: '10001' } }
    });
  });

  it('parses sequences', () => {
    expect(parse('- 1\n- 2\n- 3')).toEqual([1, 2, 3]);
  });

  it('parses mixed sequence', () => {
    const yaml = '- hello\n- 42\n- true\n- null';
    expect(parse(yaml)).toEqual(['hello', 42, true, null]);
  });

  it('parses booleans (all YAML forms)', () => {
    const yaml = 'a: true\nb: True\nc: TRUE\nd: false\ne: False\nf: FALSE';
    const result = parse(yaml);
    expect(result.a).toBe(true);
    expect(result.b).toBe(true);
    expect(result.c).toBe(true);
    expect(result.d).toBe(false);
    expect(result.e).toBe(false);
    expect(result.f).toBe(false);
  });

  it('parses null values', () => {
    const yaml = 'a: null\nb: ~\nc:';
    const result = parse(yaml);
    expect(result.a).toBe(null);
    expect(result.b).toBe(null);
    expect(result.c).toBe(null);
  });

  it('parses integers', () => {
    expect(parse('val: 42')).toEqual({ val: 42 });
    expect(parse('val: -17')).toEqual({ val: -17 });
    expect(parse('val: 0')).toEqual({ val: 0 });
  });

  it('parses floats', () => {
    expect(parse('val: 3.14')).toEqual({ val: 3.14 });
    expect(parse('val: -0.5')).toEqual({ val: -0.5 });
    expect(parse('val: 1.5e10')).toEqual({ val: 1.5e10 });
  });

  it('parses special float values', () => {
    const result = parse('a: .inf\nb: -.inf\nc: .nan');
    expect(result.a).toBe(Infinity);
    expect(result.b).toBe(-Infinity);
    expect(Number.isNaN(result.c)).toBe(true);
  });

  it('preserves quoted strings as strings', () => {
    const yaml = 'num: "42"\nbool: "true"\nnull_str: "null"';
    const result = parse(yaml);
    expect(result.num).toBe('42');
    expect(result.bool).toBe('true');
    expect(result.null_str).toBe('null');
  });

  it('parses multi-line strings (literal block)', () => {
    const yaml = 'text: |\n  line one\n  line two\n';
    const result = parse(yaml);
    expect(result.text).toContain('line one');
    expect(result.text).toContain('line two');
  });

  it('parses flow style', () => {
    const yaml = 'arr: [1, 2, 3]\nobj: {a: 1, b: 2}';
    const result = parse(yaml);
    expect(result.arr).toEqual([1, 2, 3]);
    expect(result.obj).toEqual({ a: 1, b: 2 });
  });

  it('parses anchors and aliases', () => {
    const yaml = 'defaults: &defaults\n  timeout: 30\nserver:\n  <<: *defaults\n  host: localhost';
    const result = parse(yaml);
    expect(result.server.timeout).toBe(30);
    expect(result.server.host).toBe('localhost');
  });

  it('throws on invalid YAML', () => {
    expect(() => parse('{')).toThrow();
  });

  it('coerces non-string input to string', () => {
    expect(parse(42)).toBe(42);
  });
});
