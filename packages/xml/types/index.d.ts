/**
 * Parse an XML string into a JS object.
 * Attributes use "@_" prefix, text content uses "#text".
 * Repeated sibling elements with the same tag become arrays.
 */
export function parse(text: string): unknown;

/**
 * Serialize a JS object to an XML string.
 * Keys with "@_" prefix become attributes, "#text" becomes text content.
 * Arrays produce repeated elements with the same tag.
 */
export function stringify(value: unknown): string;
