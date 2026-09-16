/**
 * 清单卡片的**字段显示偏好**（2026-09-16 用户需求）—— 纯函数，无 IO。
 *
 * ## 为什么需要它
 *
 * 一张卡默认渲染：名称 + 四类徽章 + 入口 + 条件 + 备注。信息完整，但在手机上很高 ——
 * 只想"打个卡"的用户要划很久才能扫完一页。让用户决定卡片里显示什么，
 * 关掉三行长文本后一屏能多看两三条。
 *
 * ## 什么不可关
 *
 * **名称**（没名字就不可识别）、**勾选框**（唯一交互）、**☆ 置顶**（唯一入口）
 * 都不在可配置范围内。把它们做成开关只会制造"关掉后卡片变成空白 / 勾不了"的坏状态。
 *
 * ## 三档预设 + 逐项微调
 *
 * 预设只是"一次把几项设成某个组合"的快捷方式，**不是独立模式**：
 * 用户改任意一项后就不再匹配任何预设（`matchPreset` 返回 null），UI 相应地不高亮任何一档。
 * 这样"预设"与"逐项开关"永远是同一份数据的两种表达，不会出现"预设说 A、开关说 B"。
 *
 * ## 默认值刻意等于"全部显示"
 *
 * 即当前项目的既有口径 —— 引入这个功能不该静默改变任何人的观感。
 * 想紧凑的人自己去设置页切「简要」，而不是被替他决定。
 */
import type { CardDisplay } from '../api/types';

export const DEFAULT_CARD_DISPLAY: CardDisplay = {
  tags: true,
  gain: true,
  kinds: true,
  path: true,
  condition: true,
  note: true,
};

export type CardPresetKey = 'minimal' | 'brief' | 'full';

export interface CardPreset {
  key: CardPresetKey;
  label: string;
  desc: string;
  value: CardDisplay;
}

/** 三档预设。数组顺序即设置页展示顺序（从最紧凑到最完整） */
export const CARD_PRESETS: readonly CardPreset[] = [
  {
    key: 'minimal',
    label: '极简',
    desc: '只有名称，适合"打开就打卡"，一屏能看到最多条目',
    value: { tags: false, gain: false, kinds: false, path: false, condition: false, note: false },
  },
  {
    key: 'brief',
    label: '简要',
    desc: '保留名称与各类徽章，去掉入口 / 条件 / 备注三行长文本',
    value: { tags: true, gain: true, kinds: true, path: false, condition: false, note: false },
  },
  {
    key: 'full',
    label: '完整',
    desc: '全部信息（默认）—— 不确定某条要怎么做时看得最明白',
    value: DEFAULT_CARD_DISPLAY,
  },
];

/** 逐项开关的元信息；数组顺序即设置页展示顺序 */
export const CARD_FIELDS: ReadonlyArray<{ key: keyof CardDisplay; label: string; desc: string }> = [
  { key: 'tags', label: '时间 / 截止徽章', desc: '截止倒计时、活动时间窗、一键覆盖、付费前置' },
  { key: 'gain', label: '固定收益', desc: '有保底数值的奖励（进统计页的那些）' },
  { key: 'kinds', label: '奖励类型', desc: '浮动收益的类型（勾玉 / 御魂 / 皮肤券…）' },
  { key: 'path', label: '入口路径', desc: '「庭院 → 小纸人」这类位置说明' },
  { key: 'condition', label: '参与条件', desc: '门槛说明（等级 / 前置要求）' },
  { key: 'note', label: '备注', desc: '补充提示，通常是三行长文本里最长的一条' },
];

/**
 * 归一化：缺字段补默认（老数据没有 `card` 字段），非布尔值一律忽略。
 * 与 `domain/merge.effectiveView` 同一规则 —— 那里也调它，两处不会漂移。
 */
export function effectiveCardDisplay(card?: Partial<CardDisplay> | null): CardDisplay {
  /* 返回**副本**而不是常量本身：调用方（store / merge）会把它存进 state，
     共享模块级常量意味着"某处顺手改一下返回对象"就改掉了全局默认值 */
  if (!card) return { ...DEFAULT_CARD_DISPLAY };
  const out = { ...DEFAULT_CARD_DISPLAY };
  for (const key of Object.keys(DEFAULT_CARD_DISPLAY) as Array<keyof CardDisplay>) {
    const value = card[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

/** 当前配置**完全等于**哪一档预设；都不等则 null（UI 据此决定高亮哪一档） */
export function matchPreset(card: CardDisplay): CardPresetKey | null {
  const keys = Object.keys(DEFAULT_CARD_DISPLAY) as Array<keyof CardDisplay>;
  const hit = CARD_PRESETS.find((p) => keys.every((k) => p.value[k] === card[k]));
  return hit?.key ?? null;
}

/** 被关掉的字段数 —— 设置页摘要用它说"已隐藏 3 项" */
export const hiddenFieldCount = (card: CardDisplay): number =>
  (Object.keys(card) as Array<keyof CardDisplay>).filter((k) => !card[k]).length;
