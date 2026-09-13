/**
 * 设计令牌的 TS 侧镜像 —— 仅供无法用类表达的动态值使用（设计文档 §8.2 纪律）。
 *
 * 典型合法场景（原型实测 51 处内联 style 中仅 5 处属此类）：
 *   - 进度条宽度：`style={{ width: pct + '%' }}`
 *   - 时间徽章状态色：`style={{ color: tokens.color.warn }}`
 *
 * 禁止用它绕开态类做静态样式 —— 那会破坏"令牌唯一定义处"。
 * 键名与 `tailwind.config.ts` 的 theme.extend 一一对应。
 */
export const tokens = {
  color: {
    brand: '#534AB7',
    brandSoft: '#EEEDFA',
    brandDeep: '#4A3E7A',

    ink: '#2C2C2A',
    ink2: '#5F5E5A',
    /* 2026-09-11 对比度整改：ink3 3.49:1 → 5.02:1、ink4 2.38:1 → 3.53:1（均以卡片底 #FCFBF9 计）。
       口径：ink3 可承载语义（标签 / 说明）；ink4 **只用于占位符、装饰图标、禁用态**。 */
    ink3: '#6E6D68',
    ink4: '#8A867E',

    surface: '#FCFBF9',
    surface2: '#F4F2ED',
    surface3: '#F1EFE8',

    line: '#DDD9D1',
    lineSoft: '#EDEBE6',

    danger: '#A32D2D',
    dangerSoft: '#FCEBEB',
    success: '#1D9E75',
    successDeep: '#0F6E56',
    warn: '#854F0B',
    warnSoft: '#FAEEDA',
    warnGold: '#BA7517',

    jade: '#0F6E56',
    frag: '#4A3E7A',
    ticket: '#1D5FA3',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '10px',
  },
  /** 断点：唯一判据在 hooks/useBreakpoint，此常量仅供 CSS 侧对照 */
  breakpoint: {
    md: 768,
  },
} as const;

export type Tokens = typeof tokens;
