import type { Item } from '../../api/types';
import { deadlineBadge, timeWindow } from '../../domain/countdown';
import Icon from '../icons/Icon';

/**
 * 时间窗徽章：未开始 / 进行中 / 已结束。只提示，不限制勾选。
 *
 * 2026-09-23 换肤：徽章从"实心浅底块"改为**细描边 + 极淡同色底** ——
 * 参考稿禁止用增加色块面积来提密度，密度要从"面"与"纹"里补。
 * 三态用四态色：进行中 = `state-active`（靛蓝）、未开始 = 金、
 * 已结束 = 弱化灰（它已经没有行动价值，不该抢视线）。
 */
export function TimeTag({ item, now }: { item: Item; now?: Date }) {
  const win = timeWindow(item, now);
  if (win.state === 'none') {
    return item.timeNote ? <span className="text-sm text-ink-3">{item.timeNote}</span> : null;
  }
  const style =
    win.state === 'open'
      ? 'border-state-active/40 bg-state-active/10 text-state-active'
      : win.state === 'over'
        ? 'border-line-soft bg-surface-3 text-ink-3'
        : 'border-line bg-gold-soft text-gold-hi';
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-sm border px-1.5 py-0.5 text-sm ${style}`}
    >
      <Icon name="tokei" size={11} />
      {win.text}
      {/* 寮自定时间：数据里的 time 只是参考值，用户配过的会由 domain/guildTime 叠加进来 */}
      {item.isGuildTime ? <i className="not-italic text-ink-3">· 寮自定</i> : null}
    </span>
  );
}

/**
 * 截止徽章：≤3 天朱红、≤7 天金、其余中性（活动页与今日页共用）。
 * 渲染在**标题行内**（不独占卡片右侧一列），避免压窄正文导致备注提前折行。
 */
export function DeadlineTag({ item, now }: { item: Item; now?: Date }) {
  const badge = deadlineBadge(item, now);
  const style =
    badge.level === 'hot'
      ? 'border-crimson bg-crimson/12 text-crimson'
      : badge.level === 'warn'
        ? 'border-line bg-gold-soft text-gold-hi'
        : 'border-line-soft bg-surface-3 text-ink-2';
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-sm border px-1.5 py-0.5 text-sm ${style}`}>
      {badge.level === 'hot' && badge.days !== null && badge.days <= 0 ? <Icon name="alert" size={11} /> : null}
      {badge.text}
    </span>
  );
}
