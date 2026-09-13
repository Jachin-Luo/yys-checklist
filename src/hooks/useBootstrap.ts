import { useEffect } from 'react';
import { api } from '../api';
import { resetCheckMemory, useCheckStore } from '../stores/check';
import { resetItemsMemory, useItemStore } from '../stores/items';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import { resetViewMemory, useViewStore } from '../stores/view';

/**
 * 首屏唯一入口（设计文档 §3.3）。
 *
 * `getBootstrap(scope)` 一次拿全 `meta + items + session + state + view + overrides`，
 * 因此**首屏没有加载闪烁，也没有破坏"契约是唯一数据通道"**（不用同步直读 localStorage）。
 * 骨架屏只用于懒加载的工具页。
 *
 * 切号（`session.profileId` 变化）走同一入口做**全量重载**：
 * 先清空旧档案的内存态 → 亮骨架屏 → 再聚合新档案数据。
 * 三步顺序不能换，否则会出现"新档案标题 + 旧档案勾选"的错位帧（§7.3）。
 */
export function useBootstrap(): void {
  const profileId = useSessionStore((s) => s.session?.profileId);
  /* 导入备份等"整库变了"的场景：refreshBootstrap() 递增此计数，触发整体重跑 */
  const tick = useUiStore((s) => s.bootstrapTick);

  useEffect(() => {
    let cancelled = false;
    const ui = useUiStore.getState();
    ui.setBootstrapLoading(true);
    resetItemsMemory();
    resetCheckMemory();
    resetViewMemory();

    (async () => {
      try {
        const session = await api.getSession();
        if (cancelled) return;
        useSessionStore.getState().applySession(session);

        const [profiles, payload] = await Promise.all([
          api.listProfiles(session.userId),
          api.getBootstrap({ userId: session.userId, profileId: session.profileId }),
        ]);
        if (cancelled) return;

        useSessionStore.setState({ profiles });
        useItemStore.getState().applyBootstrap(payload);
        useViewStore.getState().applyView(payload.view, payload.meta.viewDefaults);
        useCheckStore.getState().applyChecked(payload.state.checked);
        useUiStore.getState().setBootstrapError(null);
      } catch (e) {
        console.error('[bootstrap] 首屏加载失败', e);
        if (!cancelled) useUiStore.getState().setBootstrapError(e as Error);
      } finally {
        if (!cancelled) useUiStore.getState().setBootstrapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, tick]);
}
