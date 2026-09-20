import { useEffect, useState } from 'react';
import { formatRemain } from '../domain/countdown';
import type { Cycle } from '../domain/enums';
import { periodEndOf } from '../domain/reset';
import { useItemStore } from '../stores/items';

/**
 * 周期倒计时（2026-09-20 用户要求：今日 / 本周 / 本月都显示剩余时间，精确到天和小时）。
 *
 * 结束点来自 `domain/reset.periodEndOf` —— 与勾选重置共用同一组锚点函数，因此倒计时归零
 * 的那一刻正好就是勾选被重置的那一刻，两者不会各说各话。
 *
 * **每分钟重算一次**：显示粒度是小时，本用不着这么勤；但"剩 1 小时"→"不足 1 小时"这类
 * 跨档需要及时反映，而一个 setInterval 的代价远低于用户盯着一个不动的数字起疑。
 *
 * 返回 `null` 表示该周期不自动重置（once / limited），或首屏 meta 还没到 —— 两种情况下
 * 调用点都只需"不渲染"，不必区分。
 */
export function usePeriodCountdown(cycle: Cycle): string | null {
  const meta = useItemStore((s) => s.meta);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  /* `Meta` 自带 `resetHour` 与 `periods`，形状与 `ResetCtx` 一致，直接传即可 */
  if (!meta) return null;
  const end = periodEndOf(cycle, now, meta);
  return end === null ? null : formatRemain(end - now.getTime());
}
