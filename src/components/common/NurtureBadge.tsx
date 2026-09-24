import { useEffect, useMemo, useState } from 'react';
import { dueText, nextDue } from '../../domain/nurture';
import { useNurtureStore } from '../../stores/nurture';
import { useUiStore } from '../../stores/ui';
import Icon from '../icons/Icon';

/**
 * 「下一个结界卡收/续点」常驻徽章（2026-09-15 新增）。
 *
 * 放在两端的账号切换器旁：桌面侧栏底部卡片、移动端头部。理由：寄养是 6h 一次的节奏型操作，
 * 「下一次几点该收」比「打开工具页再看一眼」重要得多 —— 而它在原来的结构里只有进工具页才看得到。
 *
 * 三条口径：
 *   1. 只显示**进行中任务**里最近的那个未到点（规则在 `domain/nurture.nextDue`），
 *      没有可等的点就**不渲染任何东西**；
 *   2. **自己走时**：每 60s 重算一次（6h 粒度下足够）；
 *   3. 点击跳工具页的「结界寄养」分段，用一次性 `navRequest`。
 */
export default function NurtureBadge({
  className = '',
  compact = false,
}: {
  className?: string;
  /** 紧凑形态（移动端头部用）：只留「图标 + 剩多久」，与账号切换器挤在同一行 */
  compact?: boolean;
}) {
  const records = useNurtureStore((s) => s.records);
  const requestNav = useUiStore((s) => s.requestNav);
  const [now, setNow] = useState(() => new Date());

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

  /* 紧凑形态：移动端头部要跟账号切换器挤同一行，只留「图标 + 剩多久」，完整时刻进 title */
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => requestNav({ nav: 'tools', section: 'nurture' })}
        title={tip}
        className={`flex flex-none cursor-pointer items-center gap-1 rounded-full px-2 text-sm font-medium text-gold-hi transition-colors duration-150 ease-genso hover:bg-gold-soft ${className}`}
      >
        <Icon name="sunabochi" size={12} />
        {left}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => requestNav({ nav: 'tools', section: 'nurture' })}
      title={tip}
      className={`flex h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-fill px-2.5 text-sm text-ink-2 transition-colors duration-150 ease-genso hover:bg-fill-2 hover:text-ink ${className}`}
    >
      <Icon name="sunabochi" size={12} className="text-gold-hi" />
      <span className="min-w-0 flex-1 truncate text-left">结界卡 {when}</span>
      <b className="flex-none font-mono font-medium text-gold-hi">{left}</b>
    </button>
  );
}
