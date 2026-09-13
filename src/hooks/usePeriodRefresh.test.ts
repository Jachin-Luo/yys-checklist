import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../api';
import type { Item } from '../api/types';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { useUiStore } from '../stores/ui';
import { installMemoryStorage } from '../test/memoryStorage';
import { refreshPeriodState } from './usePeriodRefresh';

const storage = installMemoryStorage();
const cycles: Item['cycle'][] = ['daily', 'weekly', 'monthly', 'version', 'season', 'once', 'limited'];
const items: Item[] = cycles.map((cycle) => ({ id: cycle, name: cycle, cycle, origin: 'preset' }));

function checkAll(at: Date) {
  useCheckStore.getState().applyChecked(
    Object.fromEntries(items.map((item) => [item.id, at.getTime()])),
  );
}

beforeEach(async () => {
  storage.clear();
  useUiStore.setState({ bootstrapLoading: false });
  useItemStore.setState({ meta: await api.getMeta(), items, overrides: null });
  useCheckStore.getState().applyChecked({});
});

describe('refreshPeriodState', () => {
  it('resets daily checks at 05:00 without writing any storage shard', () => {
    const at = new Date(2026, 8, 15, 4, 59);
    checkAll(at);
    refreshPeriodState(at);
    expect(useCheckStore.getState().checked.daily).toBe(at.getTime());

    refreshPeriodState(new Date(2026, 8, 15, 5, 0));

    expect(useCheckStore.getState().checked).toEqual(
      Object.fromEntries(items.filter((item) => item.id !== 'daily').map((item) => [item.id, at.getTime()])),
    );
    expect(storage.written).toEqual([]);
  });

  it('resets weekly checks on Monday at 05:00', () => {
    const at = new Date(2026, 8, 14, 4, 59);
    checkAll(at);
    refreshPeriodState(at);
    expect(useCheckStore.getState().checked.weekly).toBe(at.getTime());

    refreshPeriodState(new Date(2026, 8, 14, 5, 0));

    const { checked } = useCheckStore.getState();
    expect(checked.daily).toBeUndefined();
    expect(checked.weekly).toBeUndefined();
    expect(checked.monthly).toBe(at.getTime());
    expect(checked.once).toBe(at.getTime());
  });

  it('resets monthly checks on day one at 05:00', () => {
    const at = new Date(2026, 9, 1, 4, 59);
    checkAll(at);
    refreshPeriodState(at);
    expect(useCheckStore.getState().checked.monthly).toBe(at.getTime());

    refreshPeriodState(new Date(2026, 9, 1, 5, 0));

    const { checked } = useCheckStore.getState();
    expect(checked.monthly).toBeUndefined();
    expect(checked.weekly).toBe(at.getTime());
    expect(checked.once).toBe(at.getTime());
  });

  it('removes expired items and their checks at midnight', () => {
    useItemStore.setState({
      items: [...items, { id: 'expired', name: 'Expired', cycle: 'limited', origin: 'preset', until: '2026-09-13' }],
    });
    const at = new Date(2026, 8, 13, 23, 59);
    useCheckStore.getState().applyChecked({ expired: at.getTime() });
    refreshPeriodState(at);
    expect(useItemStore.getState().items.some((item) => item.id === 'expired')).toBe(true);

    refreshPeriodState(new Date(2026, 8, 14, 0, 0));

    expect(useItemStore.getState().items).toEqual(items);
    expect(useCheckStore.getState().checked).toEqual({});
    expect(storage.written).toEqual([]);
  });

  it('keeps current optimistic checks and does not dismiss a save error', () => {
    const at = new Date(2026, 8, 15, 5, 0, 1);
    const error = new Error('Save failed');
    useCheckStore.setState({ checked: { daily: at.getTime() }, error });

    refreshPeriodState(new Date(2026, 8, 15, 5, 1));

    expect(useCheckStore.getState().checked).toEqual({ daily: at.getTime() });
    expect(useCheckStore.getState().error).toBe(error);
  });

  it.each(['missing-meta', 'bootstrap-loading'])('does not refresh during %s', (state) => {
    const checked = { daily: 1 };
    useCheckStore.getState().applyChecked(checked);
    if (state === 'missing-meta') useItemStore.setState({ meta: null });
    else useUiStore.setState({ bootstrapLoading: true });

    refreshPeriodState(new Date(2026, 8, 15, 5, 0));

    expect(useCheckStore.getState().checked).toBe(checked);
    expect(useItemStore.getState().items).toBe(items);
  });

  it('uses the latest version anchor without resetting once or limited checks', () => {
    const at = new Date(2026, 8, 14, 12);
    checkAll(at);
    const meta = useItemStore.getState().meta!;
    useItemStore.setState({
      meta: { ...meta, periods: { ...meta.periods, version: { key: 'next', startAt: '2026-09-15T09:00' } } },
    });

    refreshPeriodState(new Date(2026, 8, 15, 9, 1));

    const { checked } = useCheckStore.getState();
    expect(checked.version).toBeUndefined();
    expect(checked.season).toBe(at.getTime());
    expect(checked.once).toBe(at.getTime());
    expect(checked.limited).toBe(at.getTime());
  });
});
