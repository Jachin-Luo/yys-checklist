import type { Gain } from '../../api/types';
import type { GainKind } from '../../domain/enums';

const CURRENCY_LABEL: Record<string, string> = {
  jade: '勾玉',
  blackFrag: '黑碎',
  blueTicket: '蓝票',
};

/**
 * 币种三色徽章：**细描边 + 极淡同色底**，不做实心色块。
 * 三色本身保留（勾玉 / 黑碎 / 蓝票是业务语义，不能为了统一而抹掉区分度），
 * 但色阶都压进朱红金箔能共处的低饱和宝色区间。
 */
const CURRENCY_STYLE: Record<string, string> = {
  jade: 'border-jade/40 bg-jade/10 text-jade',
  blackFrag: 'border-frag/40 bg-frag/10 text-frag',
  blueTicket: 'border-ticket/40 bg-ticket/10 text-ticket',
};

/**
 * 固定收益徽章：有保底数值才显示（进统计页）。
 *
 * 行内文字标签统一用 `text-ink-3`（2026-09-11：曾一度压到 `ink-4`，但那个色只有 2.38:1，
 * 标签就失去意义了）。与 `ChecklistItem` 的「入口 / 条件 / 备注」同一口径：
 * **标签用 ink-3、值才有颜色**；`ink-4` 只留给占位符与装饰。
 */
export function GainBadges({ gain, note }: { gain?: Gain; note?: string }) {
  if (!gain) return null;
  const rows = Object.entries(gain).filter(([, v]) => typeof v === 'number' && v > 0);
  if (!rows.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" title={note}>
      <span className="text-sm text-ink-3">固定收益</span>
      {rows.map(([k, v]) => (
        <b
          key={k}
          className={`rounded-sm border px-1.5 py-0.5 font-mono text-sm font-medium ${
            CURRENCY_STYLE[k] ?? 'border-line-soft bg-surface-3 text-ink-2'
          }`}
        >
          {CURRENCY_LABEL[k] ?? k} +{v}
        </b>
      ))}
    </div>
  );
}

/**
 * 浮动奖励类型徽章：数量不固定，但「给不给这类东西」是固定的（需求 F21）。
 * 已在固定收益里标过数值的类型不重复显示 —— 避免「勾玉 +15」和「含 勾玉」打架。
 */
export function KindBadges({
  kinds,
  gain,
  labels,
}: {
  kinds?: GainKind[];
  gain?: Gain;
  labels: Map<string, string>;
}) {
  if (!kinds?.length) return null;
  const fixed = new Set(
    gain ? Object.entries(gain).filter(([, v]) => v > 0).map(([k]) => k) : [],
  );
  const rest = kinds.filter((k) => !fixed.has(k));
  if (!rest.length) return null;
  const hasFixed = fixed.size > 0;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-ink-3">{hasFixed ? '另有' : '含'}</span>
      {rest.map((k) => (
        <b
          key={k}
          className="rounded-sm border border-dashed border-line px-1.5 py-0.5 font-normal text-ink-2"
        >
          {labels.get(k) ?? k}
        </b>
      ))}
      <span className="text-sm text-ink-3">（数量不固定）</span>
    </div>
  );
}

/** 一键日常覆盖标记 —— 金箔小符（它是"已经有入口替你做了"，属中性提示不属危险） */
export function CoveredTag() {
  return (
    <span className="flex-none rounded-sm border border-line bg-gold-soft px-1.5 py-0.5 text-xs text-gold-hi">
      一键
    </span>
  );
}

/** 付费前置标记 —— 朱红（花钱的门槛，与"条件"同一语义家族） */
export function PremiumTag() {
  return (
    <span className="flex-none rounded-sm border border-crimson/40 bg-crimson/10 px-1.5 py-0.5 text-xs text-crimson">
      付费前置
    </span>
  );
}
