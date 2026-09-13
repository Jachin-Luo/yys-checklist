import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * 设计令牌的唯一定义处（设计文档 §8.2）。
 *
 * 纪律：
 *   1. 组件里禁止出现 `#RRGGBB` 字面量，颜色只能走令牌类（如 `text-ink-3`）；
 *   2. 禁止 `text-[13px]` 之类任意值 —— 字号收成 4 级（xs/sm/base/lg），圆角收成 3 级（sm/md/lg）；
 *   3. 需要动态计算时（进度条宽度、时间徽章状态色）用 `style` prop，
 *      值从 `src/styles/tokens.ts` 取 —— 保证 JS 与 CSS 同源，不出现两处硬编码。
 *
 * 令牌来源：原型 v8 实测频次归纳（63 个色值 → 语义命名；14 级字号 → 4 级；14 级圆角 → 3 级）。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 色·品牌 */
        brand: {
          DEFAULT: '#534AB7', // 主色（原型 x25）
          soft: '#EEEDFA', // 品牌浅底（一键日常入口卡）
          deep: '#4A3E7A',
        },
        /* 色·文字 */
        ink: {
          DEFAULT: '#2C2C2A', // 主文字（x23）· 卡片底 13.53:1
          2: '#5F5E5A', // 次要（x16）· 6.28:1
          /* 弱化 / 说明 / 标签（x65，最高频）。
             2026-09-11 由 #888780 压深：原值在卡片底只有 3.49:1、页面底 3.22:1，
             **不达 WCAG AA 正文要求的 4.5:1**，而它恰恰是全站用得最多的次要文字色。
             现值 5.02:1（卡片底）/ 4.64:1（页面底）。 */
          3: '#6E6D68',
          /* 极弱：**只允许用于占位符、装饰性图标、禁用态**，不要用来承载语义。
             原 #A9A59B 仅 2.38:1（浅块底 2.14:1），连非文本的 3:1 都不到。
             现值 3.53:1（卡片底）/ 3.17:1（浅块底）。 */
          4: '#8A867E',
        },
        /* 色·面 */
        surface: {
          DEFAULT: '#FCFBF9', // 卡片底
          2: '#F4F2ED', // 页面底
          3: '#F1EFE8', // 浅块底
        },
        /* 色·线 */
        line: {
          DEFAULT: '#DDD9D1', // 边框 / 分隔
          soft: '#EDEBE6',
          faint: '#F4F2ED',
        },
        /* 色·语义 */
        danger: { DEFAULT: '#A32D2D', soft: '#FCEBEB', line: '#F09595' },
        success: { DEFAULT: '#1D9E75', deep: '#0F6E56' },
        warn: { DEFAULT: '#854F0B', soft: '#FAEEDA', line: '#FAC775', gold: '#BA7517' },
        /* 固定收益三色：勾玉 / 黑碎 / 蓝票 */
        jade: '#0F6E56',
        frag: '#4A3E7A',
        ticket: '#1D5FA3',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      /* 字号：14 个离散值收成 4 级（+1 级标题）。
         2026-09-11 **整体抬一档**：xs 10→11 / sm 11→12 / base 12→13 / lg 13.5→14.5 / xl 15→16。
         起因：统计 83 个文件后，81% 的文字 ≤11px，而名为 `base` 的 12px 只有 4 处 ——
         事实上"正文"是 11px。CJK 在 11px / 10px 下笔画会糊。
         注意：**只能整档平移**。只抬 sm/base 会让 base(13) 与 lg(13.5) 撞在一起，层级直接塌掉。 */
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.45' }],
        base: ['13px', { lineHeight: '1.5' }],
        lg: ['14.5px', { lineHeight: '1.45' }],
        xl: ['16px', { lineHeight: '1.4' }],
      },
      /* 圆角：14 个离散值收成 3 级（+1 级胶囊容器） */
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        120: '120ms',
        180: '180ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
