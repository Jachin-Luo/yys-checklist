/**
 * 设计令牌的 TS 侧镜像 · 朱印版 —— 仅供无法用类表达的动态值使用（设计文档 §8.2 纪律）。
 *
 * 典型合法场景（原型实测 51 处内联 style 中仅 5 处属此类）：
 *   - 进度条宽度：`style={{ width: pct + '%' }}`
 *   - 进度条 / 热力格的状态色：`style={{ background: tokens.color.stateActive }}`
 *
 * 2026-09-23 换肤：颜色值不再写死十六进制，而是引用 CSS 变量 ——
 * 于是内联 style 也自动跟随明暗主题，不会出现"CSS 换了、JS 还是老色"的漂移。
 * 键名与 `tailwind.config.ts` 的 theme.extend.colors 一一对应。
 *
 * 禁止用它绕开态类做静态样式 —— 那会破坏"令牌唯一定义处"。
 */

/** 生成 `rgb(var(--c-x))`，与 tailwind 的 `rgb(var(--c-x) / <alpha-value>)` 同源 */
const v = (name: string) => `rgb(var(--c-${name}))`;

export const tokens = {
  color: {
    /* 面 */
    card: v('card'),
    cardDone: v('card-done'),
    panel: v('panel'),
    panel2: v('panel-2'),
    deep: v('deep'),

    /* 墨 */
    ink: v('ink'),
    ink2: v('ink-2'),
    ink3: v('ink-3'),
    ink4: v('ink-4'),

    /* 线 */
    line: v('line'),
    lineSoft: v('line-soft'),
    lineFaint: v('line-faint'),

    /* 金箔 / 朱红 */
    gold: v('gold'),
    goldHi: v('gold-hi'),
    goldSoft: v('gold-soft'),
    crimson: v('crimson'),
    crimsonSoft: v('crimson-soft'),
    crimsonDeep: v('crimson-deep'),

    /* 四态 */
    stateLocked: v('s-locked'),
    stateActive: v('s-active'),
    stateReady: v('s-ready'),
    stateDone: v('s-done'),

    /* 语义（与旧名保持兼容：danger 即朱红、success 即玉绿） */
    danger: v('crimson'),
    dangerSoft: v('crimson-faint'),
    success: v('jade'),
    successDeep: v('jade-deep'),
    warn: v('gold-hi'),
    warnSoft: v('gold-soft'),

    /* 币种三色 */
    jade: v('jade'),
    frag: v('frag'),
    ticket: v('ticket'),

    /** 底轨空槽 */
    track: v('track'),
  },
  radius: {
    sm: '2px',
    md: '4px',
    lg: '6px',
  },
  /** 断点：唯一判据在 hooks/useBreakpoint，此常量仅供 CSS 侧对照 */
  breakpoint: {
    md: 768,
  },
} as const;

export type Tokens = typeof tokens;
