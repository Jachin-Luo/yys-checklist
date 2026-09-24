/**
 * 控件配方（圆润版）—— 全站按钮 / 输入框 / 选项行 / 浮层的**唯一来源**。
 *
 * ## 为什么把类串抽到这里
 *
 * 2026-09-24 参考稿换成 `uiRef/囤囤鼠大作战_控件样式示例.html`（圆润版，28 类控件）。
 * 上一轮的教训是：同一颗"主按钮"在 40 个文件里各写一遍，参考稿一改就要改 40 处，
 * 而且必然漏掉几个（`ConfirmDialog` 与 `ProfilePickDialog` 的弹层材质就是这么漏的）。
 * 所以这一轮把参考稿的**控件规格**固化成这里的常量，组件只负责选配方、不再自己拼样式。
 *
 * ## 与参考稿的对应关系（改这里的值前请先读参考稿对应小节）
 *
 * | 本文件 | 参考稿 | 关键规格 |
 * | --- | --- | --- |
 * | `btn.pri` | §6 `.btn.pri` | 朱红渐变实心 + 暖白字 + 朱红落影；hover 抬 1px |
 * | `btn.sec` | §6 `.btn.sec` | 金描边 + 填充底 + 金字（上一轮的主按钮降为次级） |
 * | `btn.out` | §6 `.btn.out` | 卡片底 + 描边 + 卡片投影 |
 * | `btn.ghost` | §6 `.btn.ghost` | 无框，hover 才出填充底 |
 * | `btn.dan` | §6 `.btn.dan` | 朱红渐变（比 pri 浅，用于"删除存档"这类不可逆动作） |
 * | `btn.danger` | §6 的描边变体 | 细朱红描边 + 朱红字（次级危险动作，不抢注意力） |
 * | `field` | §8 `.wt` | 高 36 / 圆角 14 / 填充底；`focus-within` 出 3px 淡环 |
 * | `option` | §10 `.opt` | 选项行：填充底 + 描边，选中转 `fill-2` + 淡环 |
 * | `chip` | §10 `.chip` | 胶囊形筛选标签 |
 * | `tag` | §10 `.tag` | 小号方角标签（`rounded-xs`），给"自建 / 默认 / 只读"这类中文短标记 |
 * | `popover` | §9 `.sel-p` | 浮层：`panel-2` 底 + 强描边 + `shadow-pop` |
 * | `cardBox` | §13 `.fl` | `solid` 实体卡 / `group` 填充分组 |
 * | `badge` | §12 `.badge` | 计数徽章（等宽数字 + 胶囊） |
 *
 * ## 四条纪律
 *
 * 1. **不许在组件里另写一套按钮**。需要新形态先来这里加一档，否则参考稿再改又会漏。
 * 2. **尺寸档要能覆盖**：圆角与内缩**只在尺寸档里出现**，`base` 里一份都不放 ——
 *    否则 `base` 的 `rounded-md` 会盖掉 `sm`/`lg` 档的 `rounded-sm`/`rounded-lg`
 *    （Tailwind 生成顺序里 `rounded-md` 在后），`h-7` 的控件会顶着 14px 圆角。
 * 3. 尺寸只取 `md` / `sm` / `lg` 三档（对应参考稿 38 / 30 / 46px，在 Tailwind 的
 *    间距阶上落成 36 / 28 / 44px）。**不要**在调用点写 `h-8 px-5` 这类临时值。
 * 4. 这里是纯类串，不含任何 React —— 便于被页面、弹层共用。
 */

/** 尺寸档：所有控件共用同一套高度与圆角节奏（"留白跟着角走"落在这里） */
const size = {
  md: 'h-9 rounded-md px-4 text-sm',
  sm: 'h-7 rounded-sm px-3 text-xs',
  lg: 'h-11 rounded-lg px-6 text-lg',
} as const;

export type ControlSize = keyof typeof size;

export const btn = {
  /** 骨架：只放所有按钮共有的东西（**不含圆角与内缩**，见纪律 2） */
  base: 'inline-flex flex-none cursor-pointer items-center justify-center gap-2 font-medium tracking-wide transition-all duration-220 ease-genso disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
  md: size.md,
  sm: size.sm,
  lg: size.lg,
  /** 主按钮：朱红渐变实心。**同一屏最多一颗** */
  pri: 'border border-crimson/55 bg-gradient-to-b from-crimson-hi via-crimson to-crimson-deep text-on-crimson shadow-cta hover:-translate-y-px active:translate-y-0 active:scale-95',
  /** 次级按钮：金描边 + 填充底 */
  sec: 'border border-line bg-fill text-gold-hi hover:bg-fill-2 hover:text-ink',
  /** 描边按钮：卡片底（弹层里的"取消"用它） */
  out: 'border border-line bg-surface text-ink shadow-card hover:bg-surface-hi',
  /** 幽灵按钮 */
  ghost: 'text-ink-2 hover:bg-fill hover:text-ink',
  /** 不可逆动作（弹层里那颗确认）：朱红渐变，比主按钮浅一档 */
  dan: 'border border-crimson/45 bg-gradient-to-b from-crimson-hi to-crimson text-on-crimson shadow-cta hover:-translate-y-px active:translate-y-0',
  /** 次级危险动作（列表行内的删除）：细朱红描边，不抢注意力 */
  danger: 'border border-crimson-soft text-crimson hover:bg-crimson/10',
} as const;

/** 输入框外壳（参考稿 §8：外壳持边框，内层 input 无边框，前后缀共用一条圆角边） */
export const field = {
  base: 'flex w-full items-center gap-2 border bg-fill transition-colors duration-220 ease-genso focus-within:bg-fill-2 focus-within:shadow-ring',
  md: 'h-9 rounded-md px-3.5',
  sm: 'h-8 rounded-sm px-3',
  /** 文本域：外壳不固定高度、顶对齐（参考稿 `.wt.area`） */
  area: 'items-start rounded-md px-3.5 py-3',
  /** 内层 input / textarea：无边框、透明底，占满剩余宽度 */
  input: 'min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-4 focus:outline-none',
  /** 前后缀文字（单位 / 只读值） */
  affix: 'flex-none font-mono text-sm text-ink-4',
  /** 框内图标 */
  icon: 'flex-none text-ink-4',
} as const;

/** 筛选 chip（参考稿 §10 `.chip`：胶囊形） */
export const chip = {
  base: 'inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full border text-sm transition-colors duration-150 ease-genso',
  md: 'h-7 px-3.5',
  sm: 'h-6 px-2.5 text-xs',
  /** 未选：填充底 + 淡描边 */
  off: 'border-line bg-fill text-ink-2 hover:bg-fill-2 hover:text-ink',
  /** 选中（金） */
  on: 'border-line bg-gold-soft text-gold-hi',
  /** 选中（朱红，用于"危险 / 已过期"这类筛选） */
  onRed: 'border-crimson-soft bg-crimson/10 text-crimson',
} as const;

/** 小号文本标签（参考稿 §10 `.tag`）：中文短标记用这一支，不要用 `badge`（那是等宽数字的） */
export const tag = {
  base: 'inline-flex flex-none items-center gap-1 rounded-xs border px-2 text-xs',
  /** 中性 */
  mute: 'border-line bg-fill-2 text-ink-2',
  /** 金（自建 / 默认 / 高亮标记） */
  gold: 'border-line bg-gold-soft text-gold-hi',
  /** 朱红（日常覆盖 / 冲突标记） */
  red: 'border-crimson-soft bg-crimson/10 text-crimson',
  /** 靛蓝（进行中） */
  active: 'border-state-active/40 bg-state-active/10 text-state-active',
} as const;

/** 选项行（参考稿 §10 `.opt`）：单选 / 多选的整行形态 */
export const option = {
  base: 'flex w-full cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left transition-colors duration-220 ease-genso',
  off: 'border-line bg-fill hover:bg-fill-2',
  on: 'border-line bg-fill-2 shadow-ring',
} as const;

/** 浮层（参考稿 §9 `.sel-p` / §11 `.md-note` / `.pop-b`） */
export const popover =
  'rounded-lg border border-line bg-surface-3 p-1.5 shadow-pop animate-pop' as const;

/** 卡片 / 折叠分组外壳（参考稿 §13 `.fl`） */
export const cardBox = {
  /** 实体卡片：纯白卡片底 + 卡片投影 */
  solid: 'rounded-md bg-surface shadow-card',
  /** 折叠分组 / 内嵌块：填充底 + 描边（参考稿 `.fl` 用的就是这一支） */
  group: 'overflow-hidden rounded-lg border border-line bg-fill',
} as const;

/** 计数徽章（参考稿 §12 `.badge`：胶囊 + 等宽数字） */
export const badge = {
  base: 'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 font-mono text-2xs',
  red: 'bg-crimson text-on-crimson shadow-cta',
  gold: 'bg-gradient-to-b from-gold-hi to-gold text-on-gold',
  mute: 'bg-fill-3 text-ink-2',
} as const;
