import type { Gain } from '../../api/types';
import type { GainKind } from '../../domain/enums';

const CURRENCY_LABEL: Record<string, string> = {
  jade: '勾玉',
  blackFrag: '黑碎',
  blueTicket: '蓝票',
};

/**
 * 有色徽章：**细描边 + 极淡同色底**，不做实心色块。
 * 色阶都压进朱红金箔能共处的低饱和宝色区间。
 *
 * 色值在 `theme.css` 的 `--c-jade` / `--c-frag` / `--c-ticket` / `--c-tangerine` 与
 * `--c-gold-hi`（**勾玉 2026-09-29 由墨绿改朱砂红**，取值依据与对比度都算在那一处）。
 * **有数值的与只有类型的徽章共用这一份映射** —— 同一个类型在这一串里必须同色，
 * 分两份写迟早漂移。
 *
 * 覆盖范围 2026-09-30 扩过一次（用户："给金币加上金色，体力加上橘色"）：此前**只有币种三色**
 * 上色、其余一律中性灰，理由是"颜色在本项目是币种的读法"；扩到五支后口径改为
 * **暖色 = 攒起来的东西**（币种 + 金币 + 体力），御魂 / 皮肤券 / SSR/SP 等仍走中性灰 ——
 * 颜色要保有区分力，就不能人人都有。
 *
 * ⚠️ 金币用 `text-gold-hi` 而**不是** `text-gold`：`--c-gold` 是描边 / 纹样用的中间明度，
 * 当 11px 文字用对比度不够（明版仅 ≈2.8:1）；`gold-hi` 那一档本就是"文字金"（明版 5.35:1）。
 */
const KIND_STYLE: Record<string, string> = {
  jade: 'border-jade/40 bg-jade/10 text-jade',
  blackFrag: 'border-frag/40 bg-frag/10 text-frag',
  blueTicket: 'border-ticket/40 bg-ticket/10 text-ticket',
  gold: 'border-gold/40 bg-gold/10 text-gold-hi',
  stamina: 'border-tangerine/40 bg-tangerine/10 text-tangerine',
};

/**
 * 奖励徽章 —— **一个组件、一串徽章、零说明文字**（2026-09-29 由 `GainBadges` + `KindBadges` 合并）。
 *
 * ## 为什么合并
 *
 * 用户要求："之前固定收益和不固定收益展示分开了，现在直接都放在最后面，但是不用写
 * 「固定收益」「含」「另有」这些文字 —— **有数值的本身就是固定收益，一目了然**。"
 * 于是：
 *
 *   - 两类徽章**合成一串**（此前是两个组件、上下两行、各带一个前导词）；
 *   - **有数值的在前**（固定收益：实线边框 + `名称 +数值`）、**只有类型的在后**
 *     （浮动收益：虚线边框 + 只有名称）—— "实线 = 有保底、虚线 = 数量浮动"由边框承担，
 *     不再用文字标注。这与 2026-09-28 删掉"（数量不固定）"那行字是同一个方向：
 *     图形已经说清的事，再翻译回文字只是多占字宽；
 *   - 已在固定收益里出现过的类型**不重复渲染**（避免「勾玉 +20」旁边再挂一个「勾玉」）。
 *
 * ## 两条保留
 *
 * - **其余类型仍用中性灰**（御魂 / 皮肤券 / SSR/SP…）：颜色要保有区分力，就不能人人都有
 *   （2026-09-30 口径放宽为"暖色 = 攒起来的东西"，金币与体力因此上色 —— 见上方 `KIND_STYLE`）；
 * - **`gain` 与 `kinds` 的显示开关各自独立**（`card.gain` / `card.kinds`）：调用方按开关传
 *   `undefined`，合并渲染不等于把两个开关并成一个。
 *
 * `labels` 必须传（`gainKind` 的中文来自字典，单一来源）；`note` 是固定收益的口径说明
 * （如"每只 20 勾"），挂在整串的 `title` 上 —— 徽章本身太窄，塞不下这句话。
 */
export function RewardBadges({
  gain,
  kinds,
  labels,
  note,
  column = false,
}: {
  gain?: Gain;
  kinds?: GainKind[];
  /** `gainKind` 的字典标签（来自 `dictIndexOf`） */
  labels: Map<string, string>;
  /** 悬浮提示：固定收益的口径说明（如"每只 20 勾"） */
  note?: string;
  /** 右列形态（参考稿 `.pay`）：整串右对齐、可换行（竖排会把三币种摞成三行，右列反而被撑高） */
  column?: boolean;
}) {
  const fixed = gain
    ? Object.entries(gain).filter(([, v]) => typeof v === 'number' && v > 0)
    : [];
  const fixedKeys = new Set(fixed.map(([k]) => k));
  const floating = (kinds ?? []).filter((k) => !fixedKeys.has(k));
  if (!fixed.length && !floating.length) return null;

  return (
    <div
      title={note}
      className={
        column
          ? 'flex max-w-full flex-wrap items-center justify-end gap-1.5'
          : 'mt-1 flex flex-wrap items-center gap-1.5'
      }
    >
      {fixed.map(([k, v]) => (
        <b
          key={k}
          /**
           * 规格与下面的浮动徽章**逐项相同**（2026-09-29 用户反馈"有颜色的比没颜色的都大一圈"）：
           * 这一枚原先多出三样 —— 币种圆点 + 它的 `gap-1.5`、`font-medium`、以及整枚的
           * `font-mono`，于是同一串里两种徽章一胖一瘦（圆点那 6px+6px 也直接进了宽度）。
           *
           * 现在**只保留"实线边框"这一个区别**：颜色仍由 `CURRENCY_STYLE` 承担（底色 + 字色），
           * 数值单独走等宽（`font-mono` 用在这里 —— 保数字对齐，中文不跟着变宽）。
           */
          className={`inline-flex h-5 items-center rounded-full border px-2 text-xs ${
            KIND_STYLE[k] ?? 'border-line bg-fill text-ink-2'
          }`}
        >
          {CURRENCY_LABEL[k] ?? k}{' '}
          <span className="font-mono">+{v}</span>
        </b>
      ))}
      {floating.map((k) => (
        <b
          key={k}
          /* ⚠️ 字号类不能省（2026-09-24 用户反馈"奖励的字体大小太大了"）：
             这里曾漏写字号，于是继承**根字号 16px** —— 比同一行的标签、
             比任务名都大。教训见 CHANGELOG 同日条目：
             **漏写字号的元素不会报错，只会悄悄变成 16px**。
             册页稿后奖励块统一到 11px（`text-xs`）一族 */
          className={`inline-flex h-5 items-center rounded-full border border-dashed px-2 font-normal text-xs ${
            KIND_STYLE[k] ?? 'border-line text-ink-2'
          }`}
        >
          {labels.get(k) ?? k}
        </b>
      ))}
    </div>
  );
}

/**
 * 一键日常覆盖标记 —— 金箔小符（它是"已经有入口替你做了"，属中性提示不属危险）。
 *
 * 高度与 `tag.base` 同样取 **20px（`h-5`）**：它挂在标题行里，若比行高高一档，
 * 标题首行会被它撑高、第一排所有元素的中线跟着偏半像素（2026-09-29 统一基准时发现）。
 */
export function CoveredTag() {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-xs border border-line bg-gold-soft px-2 text-xs text-gold-hi">
      一键
    </span>
  );
}

/** 付费前置标记 —— 朱红（花钱的门槛，与"条件"同一语义家族）。高度同 `CoveredTag`，见其说明 */
export function PremiumTag() {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-xs border border-crimson-soft bg-crimson/10 px-2 text-xs text-crimson">
      付费前置
    </span>
  );
}
