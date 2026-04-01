import { describe, it, expect } from 'vitest';
import { stringify } from '../lib/index.mjs';

describe('yaml stringify', () => {
  it('stringifies simple object', () => {
    const result = stringify({ name: 'Alice', age: 30 });
    expect(result).toContain('name: "Alice"');
    expect(result).toContain('age: 30');
  });

  it('stringifies array', () => {
    const result = stringify([1, 2, 3]);
    expect(result).toContain('- 1');
    expect(result).toContain('- 2');
    expect(result).toContain('- 3');
  });

  it('stringifies nested structures', () => {
    const result = stringify({ a: { b: { c: 1 } } });
    expect(result).toContain('a:');
    expect(result).toContain('b:');
    expect(result).toContain('c: 1');
  });

  it('stringifies booleans', () => {
    const result = stringify({ yes: true, no: false });
    expect(result).toContain('true');
    expect(result).toContain('false');
  });

  it('stringifies null', () => {
    const result = stringify({ val: null });
    expect(result).toContain('null');
  });

  it('stringifies special floats', () => {
    const result = stringify({ a: Infinity, b: -Infinity, c: NaN });
    expect(result).toContain('.inf');
    expect(result).toContain('-.inf');
    expect(result).toContain('.nan');
  });

  it('round-trips through parse', async () => {
    const { parse } = await import('../lib/index.mjs');
    const original = { name: 'test', count: 42, items: ['a', 'b'], nested: { x: 1 } };
    const yaml = stringify(original);
    const restored = parse(yaml);
    expect(restored).toEqual(original);
  });
});
