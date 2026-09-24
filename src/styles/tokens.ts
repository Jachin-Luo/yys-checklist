/**
 * 设计令牌的 TS 侧镜像 · 圆润版 —— 仅供无法用类表达的动态值使用（设计文档 §8.2 纪律）。
 *
 * 典型合法场景（原型实测 51 处内联 style 中仅 5 处属此类）：
 *   - 进度条宽度：`style={{ width: pct + '%' }}`
 *   - 进度条 / 热力格的状态色：`style={{ background: tokens.color.stateActive }}`
 *
 * 颜色值不写死十六进制，而是引用 CSS 变量 —— 于是内联 style 也自动跟随明暗主题，
 * 不会出现"CSS 换了、JS 还是老色"的漂移。键名与 `tailwind.config.ts` 的
 * `theme.extend.colors` 一一对应（少一个键就是少一条跟随主题的路径）。
 *
 * 禁止用它绕开态类做静态样式 —— 那会破坏"令牌唯一定义处"。
 */

/** 生成 `rgb(var(--c-x))`，与 tailwind 的 `rgb(var(--c-x) / <alpha-value>)` 同源 */
const v = (name: string) => `rgb(var(--c-${name}))`;

export const tokens = {
  color: {
    /* 面（2026-09-24 起明暗两版都是"卡片最亮"） */
    card: v('card'),
    cardHi: v('card-hi'),
    cardDone: v('card-done'),
    panel: v('panel'),
    panel2: v('panel-2'),
    deep: v('deep'),

    /* 填（输入框 / 内嵌块 / 悬停底） */
    fill: v('fill'),
    fill2: v('fill-2'),
    fill3: v('fill-3'),

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
    crimsonHi: v('crimson-hi'),
    crimsonSoft: v('crimson-soft'),
    crimsonDeep: v('crimson-deep'),

    /* 四态 */
    stateLocked: v('s-locked'),
    stateActive: v('s-active'),
    stateReady: v('s-ready'),
    stateDone: v('s-done'),

    /* 语义（与旧名保持兼容：danger 即朱红、success 即 ok） */
    danger: v('crimson'),
    dangerSoft: v('crimson-faint'),
    success: v('ok'),
    successSoft: v('ok-soft'),
    successDeep: v('ok-deep'),
    warn: v('warn'),
    warnSoft: v('warn-soft'),
    info: v('info'),
    infoSoft: v('info-soft'),

    /* 实心底上的前景字（朱红主按钮 / 金渐变段） */
    onCrimson: v('on-crimson'),
    onGold: v('on-gold'),

    /* 币种三色 */
    jade: v('jade'),
    frag: v('frag'),
    ticket: v('ticket'),

    /** 底轨空槽 */
    track: v('track'),
  },
  /* 圆角（2026-09-24 圆润版整体放大 3~5 倍，与 tailwind.config 同步） */
  radius: {
    xs: '8px',
    sm: '11px',
    md: '14px',
    lg: '18px',
    xl: '24px',
  },
  /** 断点：唯一判据在 hooks/useBreakpoint，此常量仅供 CSS 侧对照 */
  breakpoint: {
    md: 768,
  },
} as const;

export type Tokens = typeof tokens;
