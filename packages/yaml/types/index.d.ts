/**
 * Parse a YAML string into a JS value. Throws on invalid input.
 */
export function parse(text: string): unknown;

/**
 * Serialize a JS value to a YAML string.
 */
export function stringify(value: unknown): string;
