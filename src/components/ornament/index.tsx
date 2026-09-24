import { type ReactNode } from 'react';
import Icon, { type IconName } from '../icons/Icon';

/**
 * 工艺层零件库 —— 朱印语言的"面"与"纹"。
 *
 * 参考稿把密度从**面（底纹、双层框、纹带）**里补，而不是靠增加颜色数量。
 * 所以这些零件全部是**无框、可缩放、纯几何**的，颜色一律走令牌类或
 * `rgb(var(--c-x))`，于是自动跟随明暗两版。
 *
 * 分层约定（`Panel` 内部一并用得到）：
 *   底纹 z-0 → 内容 z-10 → 内框 z-20 → 边缘装饰 z-30
 * 装饰层一律 `pointer-events-none`，避免压住卡片上的点击（参考稿陷阱六）。
 */

/* ───────────────────────── 底纹 ───────────────────────── */

/**
 * 麻叶纹 + 细点阵。
 * 全局面板底纹贴在 `body`（见 `styles/theme.css`），这个组件用于
 * **需要自带纹样的局部容器**（PC 侧栏、移动端顶栏、弹层）。
 */
export function Texture({ dots = false, className = '' }: { dots?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 ${
        dots ? 'genso-texture-dots' : 'genso-texture'
      } ${className}`}
    />
  );
}

/**
 * 品牌印章「囤」—— 朱红径向渐变 + 浅金衬线字（参考稿 `.sigil`，顶栏与应用栏共用）。
 * 径向渐变与内圈高光走 CSS 类（`.genso-sigil`，见 theme.css）—— Tailwind 表达不了径向，
 * 这是 AGENTS.md 样式约定里 `.genso-*` 那条豁免的第二处应用。
 */
export function Sigil({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`genso-sigil flex h-9 w-9 flex-none items-center justify-center rounded-sm font-serif text-xl font-bold text-on-crimson ${className}`}
    >
      囤
    </span>
  );
}

/* ───────────────────────── 双层框 ───────────────────────── */

/** 内框（0.8px 金、内缩 6px）+ 四角 14px L 形折角。外框由容器的 `border-line/…` 承担。 */
export function FrameInner() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-1.5 z-20 rounded-sm border border-line-soft"
    >
      <i className="absolute -left-px -top-px h-3.5 w-3.5 border-l border-t border-line" />
      <i className="absolute -right-px -top-px h-3.5 w-3.5 border-r border-t border-line" />
      <i className="absolute -bottom-px -left-px h-3.5 w-3.5 border-b border-l border-line" />
      <i className="absolute -bottom-px -right-px h-3.5 w-3.5 border-b border-r border-line" />
    </div>
  );
}

/* ───────────────────────── 横饰 ───────────────────────── */

/**
 * 御币 —— 顶栏下方横贯的 1.5px 金杆，等分垂 5 条纸垂（宽 10 高 18 尖底），
 * 纸垂内各有一条折痕竖线。
 *
 * `viewBox` 直接按目标比例 620×26 画（而不是沿用图标的 24×24 再拉伸）——
 * 参考稿陷阱四：横铺类装饰沿用方 viewBox 会把绳体与纸垂压成一排方块。
 */
export function Gohei({ className = '' }: { className?: string }) {
  return (
    /* ⚠️ `className`（外边距）挂在**外层 div**、`w-full` 留在内层 svg。
       两者挂在同一个元素上时，`w-full` 解析的是父容器宽度，再叠加 `mx-*`
       就会横向溢出 2×margin，在 `main` 上冒出一条横向滚动条。
       仓库里的 `Alert` 早用 `w-[calc(100%-1.75rem)]` 绕开了同一个问题。 */
    <div className={className}>
      <svg
        aria-hidden
        viewBox="0 0 620 26"
        preserveAspectRatio="none"
        className="h-[26px] w-full overflow-visible"
      >
      <line
        x1="0"
        y1="1.5"
        x2="620"
        y2="1.5"
        className="genso-gohei-bar"
        strokeWidth="1.5"
        opacity="0.85"
      />
      <g className="genso-gohei-paper">
        <path d="M57,2 h10 v14 l-5,4 l-5,-4 Z" />
        <path d="M181,2 h10 v14 l-5,4 l-5,-4 Z" />
        <path d="M305,2 h10 v14 l-5,4 l-5,-4 Z" />
        <path d="M429,2 h10 v14 l-5,4 l-5,-4 Z" />
        <path d="M553,2 h10 v14 l-5,4 l-5,-4 Z" />
      </g>
      <g className="genso-gohei-crease" fill="none" strokeWidth="0.8">
        <path d="M58.4,4.5 h2.4 v9.5" />
        <path d="M182.4,4.5 h2.4 v9.5" />
        <path d="M306.4,4.5 h2.4 v9.5" />
        <path d="M430.4,4.5 h2.4 v9.5" />
        <path d="M554.4,4.5 h2.4 v9.5" />
      </g>
      </svg>
    </div>
  );
}

/**
 * 墨线菱点（册页稿 `.rule`）—— 分区与分区之间的收束线：
 * 两端渐隐的墨线 + 正中一枚 5px 菱点（册页底色填充 + 墨线描边，盖在断口上）。
 * 与账目行的行间细线是两个层级：行线 1px 通长、这根**中间必须断开**——
 * 断口 + 菱点是"一节结束"的句读，通长线反而像没画完。
 */
export function Rule({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative h-px bg-gradient-to-r from-transparent via-line to-transparent ${className}`}
    >
      <i className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-line bg-surface" />
    </div>
  );
}

/**
 * 收束纹带（册页稿 `.closing`）—— 每页页脚的最后一笔：
 * 94×15 波浪线 + 中央圆点，下面一行衬线小字（四字铭）。
 * 四字铭由调用方给（今日"一日一愿" / 本周"七日一折" / 本月"一页一月" /
 * 限时"到期即归档"）—— 它是页面的落款，不是通用的装饰文案。
 */
export function Closing({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div aria-hidden className={`mt-8 flex flex-col items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 94 15"
        className="h-[15px] w-[94px] opacity-60"
        fill="none"
        stroke="rgb(var(--c-gold-line))"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M2,8 C10,3 18,13 26,8 C34,3 42,13 50,8 C58,3 66,13 74,8 C81,3.6 88,11.4 92,8" />
        <circle cx="47" cy="8" r="1.6" />
      </svg>
      <span className="font-serif text-2xs tracking-title text-ink-3">{text}</span>
    </div>
  );
}

/* ───────────────────────── 印记 ───────────────────────── */

/**
 * 蛇目纹（同心双环）—— 已完成标记，语义是"闭环"。
 * 紧贴任务名右侧 10px，**不占独立站位**（参考稿禁止项：已完成项不得占据右侧元素位，
 * 那是倒计时与进度的领地）。
 */
export function SnakeEye({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-7 -7 14 14"
      className={`flex-none text-crimson ${className}`}
      aria-hidden
    >
      <circle r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle r="2.4" fill="rgb(var(--c-crimson))" />
    </svg>
  );
}

/**
 * 达摩点睛（参考稿 §5.1）—— 本项目的"彩蛋"。
 *
 * 传统玩法：许愿时涂左眼、愿望达成时涂右眼。映射到清单上：
 * **左眼常亮（有愿在许）**，右眼在**当前页全部完成**时点亮，同时整只由金转朱红。
 * 判定不是自己算的 —— 由页面把 `.all-done` 挂在共同祖先上（见 `styles/theme.css`），
 * 与统计卡的静默处理共用同一个状态源。
 */
export function Daruma({ size = 17, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`genso-daruma flex-none ${className}`}
      role="img"
      aria-label="完成度"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12,2.6 C17.2,2.6 20.6,8.2 20.6,14.6 C20.6,19.8 16.8,22.4 12,22.4 C7.2,22.4 3.4,19.8 3.4,14.6 C3.4,8.2 6.8,2.6 12,2.6 Z" />
        <path d="M12,15.4 C11,16.6 11,18.2 12,19" />
      </g>
      <circle className="genso-daruma-eye-l" cx="8.6" cy="12.2" r="1.9" fill="currentColor" />
      <circle className="genso-daruma-eye-r" cx="15.4" cy="12.2" r="1.9" fill="currentColor" />
    </svg>
  );
}

/* ───────────────────────── 边缘装饰 ───────────────────────── */

/**
 * 竖排书脊（面板左缘）。参考稿：衬线 10.5px、字距 6px、金 50%，中间夹一枚 4px 菱形。
 *
 * `top` / `bottom` 是**定位偏移**（如 `4.5rem`），`title` / `subtitle` 才是文字内容 ——
 * 两者分开是因为书脊要避开顶栏与页脚，而文字是固定的品牌语。
 * 窄屏隐藏（参考稿 ≤620px 隐藏书脊）。
 */
export function Spine({
  top,
  bottom,
  title,
  subtitle,
}: {
  top: string;
  bottom: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-3 z-20 hidden w-4 flex-col items-center justify-center gap-1.5 font-serif text-2xs tracking-title text-gold opacity-50 [writing-mode:vertical-rl] md:flex"
      style={{ top, bottom }}
    >
      <span>{title}</span>
      <i className="my-1 h-1 w-1 flex-none rotate-45 bg-gold opacity-80" />
      <span>{subtitle}</span>
    </div>
  );
}

/* ───────────────────────── 统计三卡 ───────────────────────── */

export type StatTone = 'active' | 'ready' | 'done' | 'plain';

export interface StatItem {
  icon: IconName;
  value: string;
  label: string;
  tone?: StatTone;
}

const TONE_CLASS: Record<StatTone, string> = {
  active: 'text-state-active',
  ready: 'text-state-ready',
  done: 'text-state-done',
  plain: 'text-ink',
};

/**
 * 统计三卡 —— 数值等宽、单位小字、左上/右下 6px 折角。
 *
 * 语义由调用方给（不硬编码"进行中/待提交/已完成"）：本项目数据的真实维度是
 * 待做 / 已完成 / 分组计数，硬塞参考稿的四态会造出没有数据支撑的指标。
 *
 * **全清静默**：父级挂 `.all-done` 时，`active` / `ready` 两卡的数值退为弱化色 ——
 * 否则"任务都做完了"却还留着醒目的蓝与金，与语义打架（见 `styles/theme.css`）。
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((it) => {
        const tone = it.tone ?? 'plain';
        return (
          <div
            key={it.label}
            className={`genso-stat is-${tone} relative rounded-sm border border-line-soft bg-surface-3 px-3 pb-2.5 pt-2.5 ${
              tone === 'ready' ? 'border-line' : ''
            }`}
          >
            <i className="absolute -left-px -top-px h-1.5 w-1.5 border-l border-t border-line" />
            <i className="absolute -bottom-px -right-px h-1.5 w-1.5 border-b border-r border-line" />
            <Icon name={it.icon} size={14} className="absolute right-2.5 top-2 text-gold opacity-50" />
            <span className={`genso-stat-value block font-mono text-2xl leading-none ${TONE_CLASS[tone]}`}>
              {it.value}
            </span>
            <span className="mt-1.5 block text-2xs tracking-label text-ink-2">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── 面板外壳 ───────────────────────── */

/**
 * 面板 —— 朱印的"一张纸"：底纹 + 外框 1px 金 + 内框 0.8px 金（内缩 6px）
 * + 四角折角，内容层居中。
 *
 * PC 端**不改成参考稿的 720px 单面板**（用户决策：保留左栏 + 双列网格），
 * 这个外壳用在：弹层、移动端顶栏、以及各页顶部的"面板头"。
 */
export function Panel({
  children,
  className = '',
  spine,
}: {
  children: ReactNode;
  className?: string;
  spine?: ReactNode;
}) {
  return (
    <section className={`relative overflow-hidden rounded-lg border border-line bg-surface-2 shadow-panel ${className}`}>
      <Texture dots />
      {spine}
      <div className="relative z-10">{children}</div>
      <FrameInner />
    </section>
  );
}
