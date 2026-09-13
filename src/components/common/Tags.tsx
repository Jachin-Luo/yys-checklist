import { AlertTriangle, Clock } from 'lucide-react';
import type { Item } from '../../api/types';
import { deadlineBadge, timeWindow } from '../../domain/countdown';

/**
 * 时间窗徽章：未开始 / 进行中 / 已结束。只提示，不限制勾选。
 *
 * 颜色均为**承载语义的文字**，因此一律走 `ink-3` 及以上（2026-09-11 对比度整改：
 * `ink-4` 只留给占位符与装饰图标，不再用来写"参考时间 / 寮自定"这类信息）。
 * `open` 态用 `success-deep`(#0F6E56, 6.0:1) 而非 `success`(#1D9E75, 3.28:1)。
 */
export function TimeTag({ item, now }: { item: Item; now?: Date }) {
  const win = timeWindow(item, now);
  if (win.state === 'none') {
    return item.timeNote ? <span className="text-sm text-ink-3">{item.timeNote}</span> : null;
  }
  const style =
    win.state === 'open'
      ? 'bg-success/10 text-success-deep'
      : win.state === 'over'
        ? 'bg-surface-3 text-ink-3'
        : 'bg-warn-soft text-warn';
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm ${style}`}>
      <Clock size={10} strokeWidth={2.2} className="flex-none" />
      {win.text}
      {/* 寮自定时间：数据里的 time 只是参考值，用户配过的会由 domain/guildTime 叠加进来 */}
      {item.isGuildTime ? <i className="not-italic text-ink-3">· 寮自定</i> : null}
    </span>
  );
}

/** 截止徽章：≤3 天红、≤7 天橙（活动页与今日页共用） */
export function DeadlineTag({ item, now }: { item: Item; now?: Date }) {
  const badge = deadlineBadge(item, now);
  const style =
    badge.level === 'hot'
      ? 'bg-danger text-white'
      : badge.level === 'warn'
        ? 'bg-warn-soft text-warn'
        : 'bg-surface-3 text-ink-2';
  return (
    <span className={`flex-none rounded-sm px-1.5 py-1 text-sm ${style}`}>
      {badge.level === 'hot' && badge.days !== null && badge.days <= 0 ? <AlertTriangle size={10} className="mr-1 inline" /> : null}
      {badge.text}
    </span>
  );
}
