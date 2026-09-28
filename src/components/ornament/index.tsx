import { type ReactNode } from 'react';

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
