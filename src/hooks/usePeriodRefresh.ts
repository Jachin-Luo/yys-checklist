import { useEffect } from 'react';
import { activeItems, mergeChecked } from '../domain/reset';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

/** Re-evaluate timestamps in memory without reloading or overwriting pending writes. */
export function refreshPeriodState(now = new Date()): void {
  const { meta, items } = useItemStore.getState();
  if (!meta || useUiStore.getState().bootstrapLoading) return;

  const active = activeItems(items, now);
  const checked = mergeChecked(useCheckStore.getState().checked, active, now, meta);
  useItemStore.setState({ items: active });
  useCheckStore.setState({ checked });
}

export function usePeriodRefresh(): void {
  const meta = useItemStore((s) => s.meta);
  const profileId = useSessionStore((s) => s.session?.profileId);
  const loading = useUiStore((s) => s.bootstrapLoading);
  const nav = useUiStore((s) => s.nav);

  useEffect(() => {
    if (!meta || !profileId || loading) return;
    let timer: number | undefined;

    const refresh = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'hidden') refreshPeriodState();
      // Align to minute boundaries, including midnight and the configured reset hour.
      timer = window.setTimeout(refresh, 60000 - (Date.now() % 60000) + 1);
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [meta, profileId, loading, nav]);
}
