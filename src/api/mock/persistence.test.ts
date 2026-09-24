import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage } from '../../test/memoryStorage';
import { MockApi } from './adapter';
import { KEY } from './persist';
import { ensureStore, resetStoreForTest, saveProfiles, saveSession } from './userStore';

const storage = installMemoryStorage();
const api = new MockApi();
const scope = { userId: 'u_local', profileId: 'p_main' };

function rejectWrites() {
  return vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
}

beforeEach(() => {
  storage.clear();
  resetStoreForTest();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('persist before committing cached data', () => {
  it.each(['set', 'clear', 'clear-all'])('keeps checked data on a failed %s', async (operation) => {
    const at = Date.now();
    await api.setChecked(scope, 'daily_sign', at);
    const before = storage.getItem(KEY.state(scope.profileId));
    rejectWrites();

    const result = operation === 'set'
      ? api.setChecked(scope, 'daily_free_draw', at)
      : operation === 'clear'
        ? api.clearChecked(scope, ['daily_sign'])
        : api.clearAllChecked(scope);
    await expect(result).rejects.toThrow(Error);

    expect((await api.getState(scope)).checked).toEqual({ daily_sign: at });
    expect(storage.getItem(KEY.state(scope.profileId))).toBe(before);
    resetStoreForTest();
    expect((await api.getState(scope)).checked).toEqual({ daily_sign: at });
  });

  it('does not leak a failed check into a later successful write', async () => {
    const at = Date.now();
    const spy = rejectWrites();
    await expect(api.setChecked(scope, 'daily_sign', at)).rejects.toThrow(Error);
    spy.mockRestore();

    await api.setChecked(scope, 'daily_free_draw', at);

    expect((await api.getState(scope)).checked).toEqual({ daily_free_draw: at });
    expect(JSON.parse(storage.getItem(KEY.state(scope.profileId))!).checked).toEqual({ daily_free_draw: at });
  });

  it('keeps the previous view after saving fails', async () => {
    const before = await api.getView(scope);
    rejectWrites();

    await expect(api.saveView(scope, { ...before, sortBy: 'name', minWeight: 3 })).rejects.toThrow(Error);

    expect(await api.getView(scope)).toEqual(before);
    expect(storage.getItem(KEY.view(scope.profileId))).toBeNull();
  });

  it('does not add a custom item to the cache after saving fails', async () => {
    const before = await api.getOverrides(scope);
    rejectWrites();

    await expect(api.addCustomItem(scope, { name: 'Not saved', cycle: 'once', gainKind: [] })).rejects.toThrow(Error);

    expect(await api.getOverrides(scope)).toEqual(before);
    expect(storage.getItem(KEY.ovr(scope.profileId))).toBeNull();
  });

  it('keeps the cached session and profile list after saving fails', () => {
    const before = ensureStore();
    const session = before.session;
    const profiles = before.profiles;
    rejectWrites();

    expect(() => saveSession({ ...session, profileId: 'not-saved' })).toThrow(Error);
    expect(() => saveProfiles([])).toThrow(Error);

    expect(ensureStore().session).toBe(session);
    expect(ensureStore().profiles).toBe(profiles);
    expect(storage.getItem(KEY.session)).toBeNull();
    expect(storage.getItem(KEY.profiles)).toBeNull();
  });
});
