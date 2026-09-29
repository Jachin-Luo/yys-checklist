import type { ReactNode } from 'react';
import Icon, { type IconName } from '../icons/Icon';

/**
 * 清单卡片的「字段行」—— 2026-09-11 起：**图标即标签，颜色即分类**。
 *
 * ## 上一版的问题
 *
 * 卡片上有四行说明（奖励 / 入口 / 条件 / 备注），靠**两个汉字的中文标签 + 灰阶深浅**区分。
 * 两个汉字占掉约 24px 的横向空间 —— 在手机上这是一整列的开销；
 * 而"这行是奖励还是入口"本质上是**图标语义**，图形比文字识别更快。
 *
 * ## 现在
 *
 * | 字段 | 图标 | 颜色 | 为什么 |
 * |---|---|---|---|
 * | 入口 | 鸟居 | `ticket` | 蓝 = 位置 / 路径（鸟居本就是"入口"的和风语汇） |
 * | 条件 | 锁 | `warn` | 金 = 门槛，不满足就做不了 |
 * | 备注 | 纸 | `ink-3` | 灰 = 中性补充 |
 *
 * 三个颜色都按 **WCAG AA 正文门槛（4.5:1）** 挑过，不是凭好看选的。
 * 图标统一 13px 方形、宽度天然一致，所以右侧值文本**左边界仍然严格对齐**。
 *
 * > **原先这里还有第四类「奖励」**，2026-09-11 随 `Item.reward` 字段一起删除 ——
 * > 那行渲染的是自由文本奖励描述，与 `gainKind` 徽章信息重叠。奖励信息现在完全由
 * > `RewardBadges` 那一串徽章承担。
 *
 * ## 无障碍：中文标签没有消失，只是藏起来了
 *
 * 标签转成了 `sr-only` —— 读屏用户听到的仍是「入口 庭院 → 小纸人」；
 * 图标本身 `aria-hidden`（对读屏是装饰），鼠标用户悬停图标也能看到中文（`title`）。
 * **用图形换文字时必须保留这层文本**，否则读屏用户只会得到一串没有归属的字符串，
 * 这是这类"图标化"改动最常见的事故。
 */
export type FieldKind = 'path' | 'condition' | 'note';

const FIELD: Record<FieldKind, { icon: IconName; label: string; cls: string }> = {
  path: { icon: 'torii', label: '入口', cls: 'text-ticket' },
  condition: { icon: 'joumae', label: '条件', cls: 'text-warn' },
  note: { icon: 'fumi', label: '备注', cls: 'text-ink-3' },
};

/**
 * 只取图标 —— 用于「图标 + 一整行混合内容」的场景（如 `HubCard` 的路径行）。
 * `mt-0.5` 让 13px 的图标与 12px 文字的首行视觉居中。
 */
export function FieldIcon({ kind }: { kind: FieldKind }) {
  const { icon, label, cls } = FIELD[kind];
  return (
    <span className="mt-0.5 flex-none" title={label}>
      <Icon name={icon} size={13} className={cls} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** 完整字段行：图标 + 值。值用同一个色 —— 图形与文字互相印证，扫一眼就知道这行是什么 */
export function Field({ kind, value }: { kind: FieldKind; value: string }) {
  return (
    <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
      <FieldIcon kind={kind} />
      <span className={`min-w-0 flex-1 break-words ${FIELD[kind].cls}`}>{value}</span>
    </p>
  );
}

/**
 * 字段块（2026-09-28）—— 路径 / 条件 / 备注三行共用一个容器，左侧一道引线。
 *
 * 出处是**移动端样式稿** `.entry.open .meta{ padding-left:9px; border-left:2px solid var(--line-soft) }`：
 * 一行说明在窄屏上容易与相邻条目连成一片，缩进 + 引线把"这是上一条的补充"说清楚。
 * 参考稿只在**展开态**给这条线（默认折叠只显示路径），本项目字段是常显的（不点行展开，
 * 显隐走疏密度设置），所以常态就画。
 *
 * **两端一致**（2026-09-28 用户要求"pc 端也加上"）：桌面稿的 `.meta` 原本没有这道线，
 * 现在按用户口径两端都画 —— 账目行在两端是同一套语言，为一条引线分叉不值得。
 *
 * 调用方负责"整块全关时不渲染"（否则会留下一条没有内容的空引线）。
 */
export function FieldBlock({ children }: { children: ReactNode }) {
  return <div className="mt-2 border-l-2 border-line-soft pl-2.5">{children}</div>;
}
