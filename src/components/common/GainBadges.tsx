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
export function GainBadges({
  gain,
  note,
  column = false,
}: {
  gain?: Gain;
  note?: string;
  /** 右列形态（参考稿 `.pay`）：标签在上、徽章右对齐向下排 —— 桌面账目行独占右侧一列时用 */
  column?: boolean;
}) {
  if (!gain) return null;
  const rows = Object.entries(gain).filter(([, v]) => typeof v === 'number' && v > 0);
  if (!rows.length) return null;
  return (
    <div
      title={note}
      className={
        column
          ? 'flex flex-col items-end gap-1.5'
          : 'mt-1 flex flex-wrap items-center gap-1.5'
      }
    >
      <span className="text-2xs tracking-label text-ink-3">固定收益</span>
      {rows.map(([k, v]) => (
        <b
          key={k}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs font-medium ${
            CURRENCY_STYLE[k] ?? 'border-line bg-fill text-ink-2'
          }`}
        >
          {/* 币种点（参考稿 `.chip::before`）：颜色即币种，三色在行内自成一条竖线 */}
          <i aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
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
  column = false,
}: {
  kinds?: GainKind[];
  gain?: Gain;
  labels: Map<string, string>;
  /** 右列形态（参考稿 `.pay`），见 `GainBadges` 同名参数 */
  column?: boolean;
}) {
  if (!kinds?.length) return null;
  const fixed = new Set(
    gain ? Object.entries(gain).filter(([, v]) => v > 0).map(([k]) => k) : [],
  );
  const rest = kinds.filter((k) => !fixed.has(k));
  if (!rest.length) return null;
  const hasFixed = fixed.size > 0;
  return (
    <div
      className={
        column
          ? 'flex flex-col items-end gap-1.5'
          : 'mt-1 flex flex-wrap items-center gap-1.5'
      }
    >
      <span className="text-2xs tracking-label text-ink-3">{hasFixed ? '另有' : '含'}</span>
      {rest.map((k) => (
        <b
          key={k}
          /* ⚠️ 字号类不能省（2026-09-24 用户反馈"奖励的字体大小太大了"）：
             这里曾漏写字号，于是继承**根字号 16px** —— 比同一行的标签、
             比上一行「固定收益」的徽章、甚至比任务名都大。教训见 CHANGELOG 同日条目：
             **漏写字号的元素不会报错，只会悄悄变成 16px**。
             册页稿后奖励块统一到 11px（`text-xs`）一族 */
          className="rounded-full border border-dashed border-line px-2 py-0.5 font-normal text-xs text-ink-2"
        >
          {labels.get(k) ?? k}
        </b>
      ))}
      <span className="text-xs text-ink-3">（数量不固定）</span>
    </div>
  );
}

/** 一键日常覆盖标记 —— 金箔小符（它是"已经有入口替你做了"，属中性提示不属危险） */
export function CoveredTag() {
  return (
    <span className="flex-none rounded-xs border border-line bg-gold-soft px-2 py-0.5 text-xs text-gold-hi">
      一键
    </span>
  );
}

/** 付费前置标记 —— 朱红（花钱的门槛，与"条件"同一语义家族） */
export function PremiumTag() {
  return (
    <span className="flex-none rounded-xs border border-crimson-soft bg-crimson/10 px-2 py-0.5 text-xs text-crimson">
      付费前置
    </span>
  );
}
