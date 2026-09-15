import { describe, it, expect } from 'vitest';
import { validateUserName } from '../../src/utils/validation.js';

describe('validateUserName', () => {
  it('accepts a valid name', () => {
    const r = validateUserName('Алекс');
    expect(r.valid).toBe(true);
    expect(r.value).toBe('Алекс');
  });

  it('accepts latin, digits, spaces, _ and -', () => {
    expect(validateUserName('John_Doe-2').valid).toBe(true);
    expect(validateUserName('Anna Smith').valid).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const r = validateUserName('  Bob  ');
    expect(r.valid).toBe(true);
    expect(r.value).toBe('Bob');
  });

  it('rejects empty / whitespace-only name', () => {
    expect(validateUserName('').valid).toBe(false);
    expect(validateUserName('   ').valid).toBe(false);
  });

  it('rejects name longer than 30 chars', () => {
    expect(validateUserName('a'.repeat(31)).valid).toBe(false);
  });

  it('accepts name exactly 30 chars', () => {
    expect(validateUserName('a'.repeat(30)).valid).toBe(true);
  });

  it('rejects special characters (XSS-like)', () => {
    expect(validateUserName('<script>').valid).toBe(false);
    expect(validateUserName('bob@host').valid).toBe(false);
    expect(validateUserName('a!b').valid).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateUserName(null).valid).toBe(false);
    expect(validateUserName(undefined).valid).toBe(false);
    expect(validateUserName(123).valid).toBe(false);
  });
});
