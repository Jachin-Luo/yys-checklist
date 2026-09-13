import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_KEY } from '../services/localStore';
import { installMemoryStorage } from '../test/memoryStorage';
import { resetNurtureMemory, useNurtureStore } from './nurture';

const storage = installMemoryStorage();

beforeEach(() => {
  storage.clear();
  resetNurtureMemory();
});

afterEach(() => vi.restoreAllMocks());

describe('nurture persistence', () => {
  it('saves only the device key and reloads its records', () => {
    useNurtureStore.getState().add('20:00', 3, false);
    const records = useNurtureStore.getState().records;
    expect(records).toHaveLength(1);
    expect(storage.written).toEqual([DEVICE_KEY.plans]);

    resetNurtureMemory();
    useNurtureStore.getState().hydrate();
    expect(useNurtureStore.getState().records).toEqual(records);
  });

  it.each(['add', 'promote', 'remove', 'clearAll'] as const)('retains saved records when %s fails', (operation) => {
    useNurtureStore.getState().add('20:00', 3, false);
    const records = useNurtureStore.getState().records;
    const persisted = storage.getItem(DEVICE_KEY.plans);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const actions = {
      add: () => useNurtureStore.getState().add('21:00', 2, true),
      promote: () => useNurtureStore.getState().promote(records[0].id),
      remove: () => useNurtureStore.getState().remove(records[0].id),
      clearAll: () => useNurtureStore.getState().clearAll(),
    };

    expect(actions[operation]).not.toThrow();

    expect(useNurtureStore.getState().records).toBe(records);
    expect(useNurtureStore.getState().error).toBeTruthy();
    expect(storage.getItem(DEVICE_KEY.plans)).toBe(persisted);
  });
});
