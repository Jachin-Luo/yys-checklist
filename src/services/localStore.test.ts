import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage } from '../test/memoryStorage';
import { read, remove, write } from './localStore';

const storage = installMemoryStorage();

beforeEach(() => {
  storage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('local storage failures', () => {
  it('serializes values and reads them back', () => {
    write('test', { checked: { daily_sign: 123 } });
    expect(read('test')).toEqual({ checked: { daily_sign: 123 } });
    remove('test');
    expect(read('test')).toBeNull();
  });

  it.each(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])('propagates %s without changing old data', (name) => {
    write('test', { old: true });
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', name);
    });

    expect(() => write('test', { old: false })).toThrow('\u7a7a\u95f4\u4e0d\u8db3');
    expect(read('test')).toEqual({ old: true });
  });

  it('rejects writes when the browser storage getter is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new DOMException('Denied', 'SecurityError');
      },
    });

    expect(() => write('test', true)).toThrow(Error);
    expect(() => remove('test')).toThrow(Error);
    expect(read('test')).toBeNull();
  });

  it('rejects writes without a browser storage implementation', () => {
    vi.stubGlobal('window', undefined);
    expect(() => write('test', true)).toThrow(Error);
    expect(() => remove('test')).toThrow(Error);
  });

  it('propagates removal failures while retaining the saved value', () => {
    write('test', true);
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });

    expect(() => remove('test')).toThrow(Error);
    expect(read('test')).toBe(true);
  });
});
