import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * 设计令牌的唯一定义处 · **朱印版**。
 *
 * ## 纪律（沿用并强化）
 *
 *   1. 组件里禁止出现 `#RRGGBB` 字面量，颜色只能走令牌类（如 `text-ink-3`）；
 *   2. 禁止 `text-[13px]` 之类任意值 —— 字号、圆角、字距、阴影都走令牌；
 *   3. 需要动态计算时（进度条宽度、状态色）用 `style`，值从 `src/styles/tokens.ts` 取，
 *      保证 JS 与 CSS 同源。
 *
 * ## 2026-09-23 换肤：取值从"十六进制字面量"改为 CSS 变量
 *
 * 颜色槽现在指向 `rgb(var(--c-x) / <alpha-value>)`，变量定义在 `src/styles/theme.css`，
 * 由 `html[data-theme="light"|"dark"]` 切换 —— 双主题是"改一处令牌即全局生效"，
 * 而不是把 40 个组件各改一遍。
 *
 * 原先的 `brand` / `brand-soft` / `brand-deep`（品牌紫）已**整体退场**并改成
 * `gold` / `gold-soft` / `crimson-deep`：朱印语言里没有紫色，
 * 主色是金箔（描边 / 纹样 / 主按钮），强调色是朱红（印记 / 划除线 / 危险）。
 */
const c = (v: string) => `rgb(var(--c-${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 色·面：面板 → 卡片（明版卡片更暗、暗版卡片更亮，浮起方向永远背离底色） */
        surface: {
          DEFAULT: c('card'), // 卡片底
          2: c('panel'), // 面板 / 页面底
          3: c('panel-2'), // 次级块 / 悬停底
          deep: c('deep'), // 最深一档：底栏、最外留白
        },
        'card-done': c('card-done'), // 已完成卡（主动沉下去）

        /* 色·墨：四档文字。ink-4 只允许占位符 / 装饰图标 / 禁用态 */
        ink: {
          DEFAULT: c('ink'),
          2: c('ink-2'),
          3: c('ink-3'),
          4: c('ink-4'),
        },

        /* 色·线：金三档（外框 / 卡片描边 / 块内分隔） */
        line: {
          DEFAULT: c('line'),
          soft: c('line-soft'),
          faint: c('line-faint'),
        },

        /* 色·金箔：描边 / 纹样 / 序号 / 倒计时 / 主按钮 */
        gold: {
          DEFAULT: c('gold'),
          hi: c('gold-hi'),
          soft: c('gold-soft'),
        },

        /* 色·朱红：印记 / 划除线 / 危险 / 完成 */
        crimson: {
          DEFAULT: c('crimson'),
          soft: c('crimson-soft'),
          deep: c('crimson-deep'),
          faint: c('crimson-faint'),
        },

        /* 色·语义 */
        danger: { DEFAULT: c('crimson'), soft: c('crimson-faint'), line: c('crimson-soft') },
        success: { DEFAULT: c('jade'), deep: c('jade-deep') },
        warn: { DEFAULT: c('gold-hi'), soft: c('gold-soft'), line: c('line'), gold: c('gold-hi') },

        /* 色·四态（参考稿 §4.2：未接取 / 进行中 / 可提交 / 已完成） */
        state: {
          locked: c('s-locked'),
          active: c('s-active'),
          ready: c('s-ready'),
          done: c('s-done'),
        },

        /* 色·币种三色（勾玉 / 黑碎 / 蓝票）—— 业务语义，不参与换肤重命名 */
        jade: c('jade'),
        frag: c('frag'),
        ticket: c('ticket'),

        /* 色·卡片底轨空槽（「已完成」时由内层朱红段填充） */
        track: c('track'),

        /* 色·弹层遮罩 */
        scrim: c('scrim'),
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
        /* 标题 / 任务名 / 分组名走衬线，是朱印语言的骨架 */
        serif: ['Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'SimSun', 'serif'],
        /* 倒计时 / 计数 / 序号走等宽，数字不跳 */
        mono: ['ui-monospace', 'Consolas', 'Roboto Mono', 'monospace'],
      },
      /* 字号：原 14 级 → 4 级 →（2026-09-23 换肤）加两档
         朱印语言需要 10px 的标签字与 19px 的数值字，都在既有档位之外，
         硬塞进 xs/xl 会让"标签"和"正文"撞在一起。 */
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.5' }],
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.45' }],
        base: ['13px', { lineHeight: '1.5' }],
        lg: ['14.5px', { lineHeight: '1.45' }],
        xl: ['16px', { lineHeight: '1.4' }],
        '2xl': ['19px', { lineHeight: '1.3' }],
      },
      /* 圆角：2026-09-23 由 6/8/10/14 收方到 2/4/6/10（符札感，参考稿 --r-sm/md/lg） */
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '10px',
      },
      letterSpacing: {
        /* 朱印的字距是分层信息：主标题最疏、标签次之、卡片最紧 */
        title: '5px',
        group: '0.2em',
        label: '0.16em',
        wide: '0.08em',
        card: '0.6px',
      },
      boxShadow: {
        panel: 'var(--sh-panel)',
        card: 'var(--sh-card)',
        /* 「唯一高亮位」悬停时的金晕（参考稿 .task[data-state=ready]:hover） */
        ready: '0 0 22px rgb(var(--c-gold-hi) / 0.2)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        /* 参考稿统一曲线：划除线 / 底轨增长 / 蛇目纹淡入全部走它 */
        genso: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      },
      transitionDuration: {
        120: '120ms',
        180: '180ms',
        220: '220ms',
        300: '300ms',
        350: '350ms',
      },
      keyframes: {
        /* 入场只做位移 —— opacity 进 @keyframes 会在动画被冻结时让整块永久不可见 */
        reveal: {
          from: { transform: 'translateY(5px)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        reveal: 'reveal 300ms cubic-bezier(0.2, 0.9, 0.3, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
