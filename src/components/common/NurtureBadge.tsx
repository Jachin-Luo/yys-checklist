import { useEffect, useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { dueText, nextDue } from '../../domain/nurture';
import { useNurtureStore } from '../../stores/nurture';
import { useUiStore } from '../../stores/ui';

/**
 * 「下一个结界卡收/续点」常驻徽章（2026-09-15 新增）。
 *
 * 放在两端的档案切换器旁：桌面侧栏底部卡片、移动端头部。理由：寄养是 6h 一次的节奏型操作，
 * 「下一次几点该收」比「打开工具页再看一眼」重要得多 —— 而它在原来的结构里只有进工具页才看得到。
 *
 * 三条口径：
 *   1. 只显示**进行中任务**里最近的那个未到点（规则在 `domain/nurture.nextDue`），
 *      没有可等的点就**不渲染任何东西** —— 计划不背状态、点全过完的任务也无事可做；
 *   2. **自己走时**：每 60s 重算一次（6h 粒度下足够，与寄养页的刷新间隔同一口径），
 *      不需要用户手动刷新页面；
 *   3. 点击跳工具页的「结界寄养」分段，用一次性 `navRequest`（见 `stores/ui`）——
 *      工具页不在首屏主包里，用户不需要知道"要先切页再切分段"。
 */
export default function NurtureBadge({
  className = '',
  compact = false,
}: {
  className?: string;
  /** 紧凑形态（移动端头部用）：只留「图标 + 剩多久」，与档案切换器挤在同一行 */
  compact?: boolean;
}) {
  const records = useNurtureStore((s) => s.records);
  const requestNav = useUiStore((s) => s.requestNav);
  const [now, setNow] = useState(() => new Date());

  /* 2026-09-16：不再自己读数据。寄养记录升为档案级后走首屏 `getBootstrap().plans`，
     徽章直接消费 store 即可 —— 因此也不会再出现"徽章显示的是上一个号"的中间帧。
     （bootstrap 完成前壳层本来就是骨架屏，不存在"数据没到却要显示徽章"的空档。） */

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const due = useMemo(() => nextDue(records, now), [records, now]);
  if (!due) return null;

  /* 「今天」不写出来，只留 HH:mm —— 徽章常在两端的窄容器里，一个词也是宽度 */
  const when = due.point.dayLabel === '今天' ? due.point.hm : `${due.point.dayLabel} ${due.point.hm}`;
  const left = dueText(due.point.ts, now);
  const tip = `结界寄养：${due.record.base} 上卡 · 下一个收/续点在 ${due.point.dayLabel} ${due.point.hm} · 点此打开寄养页`;

  /* 紧凑形态：移动端头部要跟档案切换器挤同一行，只留「图标 + 剩多久」，完整时刻进 title */
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => requestNav({ nav: 'tools', section: 'nurture' })}
        title={tip}
        className={`flex flex-none cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-sm font-medium text-brand transition-colors duration-120 hover:bg-brand-soft ${className}`}
      >
        <Hourglass size={12} strokeWidth={2.2} className="flex-none" />
        {left}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => requestNav({ nav: 'tools', section: 'nurture' })}
      title={tip}
      className={`flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-brand hover:text-ink ${className}`}
    >
      <Hourglass size={12} strokeWidth={2.2} className="flex-none text-brand" />
      <span className="min-w-0 flex-1 truncate text-left">结界卡 {when}</span>
      <b className="flex-none font-medium text-brand">{left}</b>
    </button>
  );
}
