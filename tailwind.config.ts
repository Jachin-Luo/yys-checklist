import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * 设计令牌的唯一定义处 · **圆润版**。
 *
 * ## 纪律（沿用并强化）
 *
 *   1. 组件里禁止出现 `#RRGGBB` 字面量，颜色只能走令牌类（如 `text-ink-3`）；
 *   2. 禁止 `text-[13px]` 之类任意值 —— 字号、圆角、字距、阴影都走令牌；
 *   3. 需要动态计算时（进度条宽度、状态色）用 `style`，值从 `src/styles/tokens.ts` 取，
 *      保证 JS 与 CSS 同源。
 *
 * ## 2026-09-24 换代：方正 → 圆润
 *
 * 参考稿换成 `uiRef/囤囤鼠大作战_控件样式示例.html`，四条铁律：**角越圆线越淡 /
 * 阴影要散不要贴 / 留白跟着角走 / 内部零件也圆**。本文件的改动：
 *
 *   - **圆角阶整体放大 3~5 倍**（2/4/6/10 → 8/11/14/18/24，另加 30 给浮层）；
 *   - **阴影换成三级柔和**（`card` / `pop` / `panel`，大扩散 + 低透明 + gloss 高光）；
 *   - **新增填充层 `fill`**（输入框 / 内嵌块 / 悬停底）与语义色 `ok` / `warn` / `info`；
 *   - 焦点环颜色、字距曲线（`ease-genso`）同步参考稿。
 *
 * 颜色槽仍指向 `rgb(var(--c-x) / <alpha-value>)`，变量定义在 `src/styles/theme.css`，
 * 由 `html[data-theme="light"|"dark"]` 切换 —— 换肤只改令牌取值，不改类名。
 *
 * 上一轮退场的 `brand` / `brand-soft` / `brand-deep`（品牌紫）保持退场状态：
 * 朱印语言里没有紫色，主色是金箔（描边 / 纹样 / 次数），强调色是朱红（主按钮 / 印记 / 危险）。
 */
const c = (v: string) => `rgb(var(--c-${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 色·面：卡片（最亮）→ 面板 → 次级块 → 最深一档。
           2026-09-24 起**明暗两版的卡片都比面板亮**（明版卡片是纯白） */
        surface: {
          DEFAULT: c('card'), // 卡片底
          hi: c('card-hi'), // 卡片上的悬停面 / 次级卡
          2: c('panel'), // 面板 / 页面底
          3: c('panel-2'), // 次级块 / 壳层底
          deep: c('deep'), // 最深一档：底栏、最外留白
        },
        'card-done': c('card-done'), // 已完成卡（主动沉下去）

        /* 色·填：半透明填充层（输入框 / 内嵌块 / 悬停底）。
           参考稿是 rgba 白/黑，本项目按卡片烘焙成不透明等效色，理由见 theme.css */
        fill: {
          DEFAULT: c('fill'),
          2: c('fill-2'),
          3: c('fill-3'),
        },

        /* 色·墨：四档文字。ink-4 只允许占位符 / 装饰图标 / 禁用态 */
        ink: {
          DEFAULT: c('ink'),
          2: c('ink-2'),
          3: c('ink-3'),
          4: c('ink-4'),
        },

        /* 色·线：金三档（外框 / 卡片描边 / 块内分隔）——比方正版**整体淡一档** */
        line: {
          DEFAULT: c('line'),
          soft: c('line-soft'),
          faint: c('line-faint'),
        },

        /* 色·金箔：描边 / 纹样 / 序号 / 倒计时 / 次级主按钮。
           `line` 是册页稿新增的金线档（chip / 金券条 / 印章圈描边共用） */
        gold: {
          DEFAULT: c('gold'),
          hi: c('gold-hi'),
          soft: c('gold-soft'),
          line: c('gold-line'),
        },

        /* 色·实心底上的前景字（参考稿 .btn.pri 的 #FFF6F0 / .badge.gold 的 #1A1509）。
           不这么存的话，组件里就得写 #FFF6F0 这类字面量，违反"令牌唯一定义处" */
        'on-crimson': c('on-crimson'),
        'on-gold': c('on-gold'),

        /* 色·朱红：主按钮 / 印记 / 划除线 / 危险 / 完成。
           `btn(-hi)` 与主题朱红分家：暗版主色太亮（白字 2.86），按钮另取深一档（参考稿算过） */
        crimson: {
          DEFAULT: c('crimson'),
          hi: c('crimson-hi'), // 渐变浅端（明版压深、暗版提亮，方向相反）
          soft: c('crimson-soft'),
          deep: c('crimson-deep'),
          faint: c('crimson-faint'),
          btn: c('crimson-btn'),
          'btn-hi': c('crimson-btn-hi'),
        },

        /* 色·印章（品牌印 / 应用栏 sigil 的径向渐变两端） */
        seal: {
          DEFAULT: c('seal'),
          hi: c('seal-hi'),
        },

        /* 色·语义。`danger` 与朱红同源（朱红一支两用），不另立门户 */
        danger: { DEFAULT: c('crimson'), soft: c('crimson-faint'), line: c('crimson-soft') },
        success: { DEFAULT: c('ok'), soft: c('ok-soft'), deep: c('ok-deep') },
        warn: { DEFAULT: c('warn'), soft: c('warn-soft'), line: c('line') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },

        /* 色·四态（未接取 / 进行中 / 可提交 / 已完成） */
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

        /* 色·底轨空槽（进度条 / 卡片底轨） */
        track: c('track'),

        /* 色·弹层遮罩与焦点环 */
        scrim: c('scrim'),
        ring: c('ring'),
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
        /* 倒计时 / 计数 / 序号走等宽，数字不跳（册页稿把 JetBrains Mono 提到首位） */
        mono: ['JetBrains Mono', 'Cascadia Mono', 'ui-monospace', 'Consolas', 'Roboto Mono', 'monospace'],
      },
      /* 字号：原 14 级 → 4 级 →（2026-09-23）加两档，
         圆润版沿用：10px 的标签字与 19px 的数值字都在既有档位之外 */
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.5' }],
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.45' }],
        base: ['13px', { lineHeight: '1.5' }],
        lg: ['14.5px', { lineHeight: '1.45' }],
        xl: ['16px', { lineHeight: '1.4' }],
        '2xl': ['19px', { lineHeight: '1.3' }],
        /* 册页稿的桌面书眉大标题（29px，全页唯一）—— 在既有档位之外，为它单开一档 */
        '3xl': ['29px', { lineHeight: '1.1' }],
      },
      /* 圆角：2026-09-23 由 6/8/10/14 收方到 2/4/6/10（符札感）；
         2026-09-24 圆润版**整体放大 3~5 倍**（参考稿 `--r-xs:8 / sm:11 / md:14 / lg:18 / xl:24 / 2xl:30`）。
         档位语义保持不变，所以组件里的类名一个都不用改：
           xs 标签 / sm 小控件 / md 按钮与卡片 / lg 输入框与提示条 / xl 面板与空态 / 2xl 弹层与抽屉 */
      borderRadius: {
        xs: '8px',
        sm: '11px',
        md: '14px',
        lg: '18px',
        xl: '24px',
        '2xl': '30px',
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
        /* 三级柔和：card（贴地）→ pop（浮起）→ panel（脱离页面） */
        card: 'var(--sh-card)',
        pop: 'var(--sh-pop)',
        panel: 'var(--sh-panel)',
        /* 朱红渐变主按钮自己的落影（参考稿 .btn.pri） */
        cta: 'var(--sh-cta)',
        /* 「唯一高亮位」悬停时的金晕（参考稿 .task[data-state=ready]:hover） */
        ready: '0 0 22px rgb(var(--c-gold-hi) / 0.2)',
        /* 字段 / 选项聚焦或选中时的「宽而淡外扩」（参考稿 `0 0 0 3px var(--ring)`）。
           与键盘焦点的 2px 金环分工见 `styles/base.css` 的 :focus-visible 说明 */
        ring: '0 0 0 3px rgb(var(--c-ring))',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        /* 参考稿统一曲线（册页稿的 --ease）：全站过渡都走它 */
        genso: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      transitionDuration: {
        120: '120ms',
        /* 圆润版参考稿的 --t-fast */
        150: '150ms',
        180: '180ms',
        /* 圆润版参考稿的 --t（默认时长） */
        220: '220ms',
        300: '300ms',
        350: '350ms',
      },
      keyframes: {
        /* 入场只做位移 —— opacity 进 @keyframes 会在动画被冻结时让整块永久不可见。
           圆润版参考稿在浮层与骨架上都重申了这条 */
        reveal: {
          from: { transform: 'translateY(5px)' },
          to: { transform: 'translateY(0)' },
        },
        /* 浮层入场（参考稿 @keyframes pop）：位移 + 轻微缩放，**不含 opacity** */
        pop: {
          from: { transform: 'translateY(-7px) scale(0.98)' },
          to: { transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        reveal: 'reveal 300ms cubic-bezier(0.32, 0.72, 0.28, 1)',
        pop: 'pop 220ms cubic-bezier(0.32, 0.72, 0.28, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
