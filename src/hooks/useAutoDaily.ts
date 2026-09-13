import { useCallback, useMemo } from 'react';
import { cascadeBatch, effectiveAutoSet, hubItem } from '../domain/autoDaily';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { useViewStore, type CoverMode } from '../stores/view';

/**
 * 一键日常的读写封装：入口级联勾选 + 覆盖集合配置 + 显示方式。
 *
 * 规则都在 `domain/autoDaily.ts`（纯函数，有单测），本 hook 只做状态编排 ——
 * 两端布局里不出现任何覆盖/级联判断。
 */
export interface AutoDailyApi {
  /** 一键日常入口条目 */
  hub: ReturnType<typeof hubItem> | null;
  /** 归一后的覆盖集合（仅常驻每日候选，已剔除失效 id） */
  coveredIds: string[];
  coveredSet: Set<string>;
  coveredCount: number;
  coverMode: CoverMode;
  /** 入口双向级联：已勾 → 全部取消；未勾 → 全部勾选 */
  toggleHub: () => void;
  /** 逐项配置覆盖集合（写显式快照） */
  setCovered: (itemId: string, covered: boolean) => void;
  setCoverMode: (mode: CoverMode) => Promise<void>;
  resetAutoSet: () => Promise<void>;
}

export function useAutoDaily(): AutoDailyApi {
  const items = useItemStore((s) => s.items);
  const view = useViewStore((s) => s.view);
  const setAutoSet = useViewStore((s) => s.setAutoSet);
  const resetAutoSet = useViewStore((s) => s.resetAutoSet);
  const setCoverMode = useViewStore((s) => s.setCoverMode);
  const toggleWithCascade = useCheckStore((s) => s.toggleWithCascade);

  const coveredIds = useMemo(() => effectiveAutoSet(items, view), [items, view]);
  const coveredSet = useMemo(() => new Set(coveredIds), [coveredIds]);
  const hub = useMemo(() => hubItem(items) ?? null, [items]);

  const toggleHub = useCallback(() => {
    if (!hub) return;
    const [hubId, ...rest] = cascadeBatch(items, hub.id, coveredIds);
    void toggleWithCascade(hubId, rest);
  }, [hub, items, coveredIds, toggleWithCascade]);

  const setCovered = useCallback(
    (itemId: string, covered: boolean) => {
      const next = covered
        ? [...coveredIds, itemId]
        : coveredIds.filter((id) => id !== itemId);
      void setAutoSet(next);
    },
    [coveredIds, setAutoSet],
  );

  return {
    hub,
    coveredIds,
    coveredSet,
    coveredCount: coveredIds.length,
    coverMode: (view.coverMode ?? 'dim') as CoverMode,
    toggleHub,
    setCovered,
    setCoverMode,
    resetAutoSet,
  };
}
