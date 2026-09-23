import { useEffect } from 'react';
import { api } from '../api';
import { resetCheckMemory, useCheckStore } from '../stores/check';
import { resetGuildTimeMemory, useGuildTimeStore } from '../stores/guildTime';
import { resetItemsMemory, useItemStore } from '../stores/items';
import { resetNurtureMemory, useNurtureStore } from '../stores/nurture';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import { resetViewMemory, useViewStore } from '../stores/view';

/**
 * 首屏唯一入口（设计文档 §3.3）。
 *
 * `getBootstrap(scope)` 一次拿全
 * `meta + items + session + state + view + overrides + log + guildTime + plans`，
 * 因此**首屏没有加载闪烁，也没有破坏"契约是唯一数据通道"**（不用同步直读 localStorage）。
 * 骨架屏只用于懒加载的工具页。
 *
 * 2026-09-16：`guildTime` 与 `plans` 由设备级升为账号级后也走这个入口 ——
 * 壳层的结界卡徽章此前是"自己读一次 localStorage"，现在跟着首屏一起下来，
 * 切号时与其它数据同进同出，不再有"徽章还是上个号"的中间帧。
 *
 * 切号（`session.profileId` 变化）走同一入口做**全量重载**：
 * 先清空旧账号的内存态 → 亮骨架屏 → 再聚合新账号数据。
 * 三步顺序不能换，否则会出现"新账号标题 + 旧账号勾选"的错位帧（§7.3）。
 * **下面五个 `resetXxx` 与 `payload` 的字段必须一一对应**：漏一个就会出现该字段的错位帧。
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
    resetGuildTimeMemory();
    resetNurtureMemory();

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
        useCheckStore.getState().applyChecked(payload.state.checked, payload.log.days);
        useGuildTimeStore.getState().applyGuildTime(payload.guildTime);
        useNurtureStore.getState().applyPlans(payload.plans);
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
