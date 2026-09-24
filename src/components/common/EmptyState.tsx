import type { ReactNode } from 'react';
import Icon, { type IconName } from '../icons/Icon';
import { cardBox } from './controls';
import { CHECKLIST_GRID } from '../../styles/layout';

/**
 * 空状态 —— 器物类**只做单色描边、不做填充色块**（参考稿禁止项）。
 * 上一版是一个灰圆底 + 收件箱图标；现在换成一座空鸟居：
 * 语义上正好是"这里今天没有要办的委托"，且不引入任何色块。
 *
 * 2026-09-24 圆润版：对齐参考稿 §12 `.empty` —— 虚线圆角框 + `bg-fill` 图标座。
 * 虚线框是这里的重点：它同时表达"这里本该有内容"，比一段孤零零的灰字更能解释空的原因。
 */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-soft px-5 py-8 text-center">
      <span className="mb-0.5 flex h-12 w-12 items-center justify-center rounded-lg bg-fill text-ink-4">
        <Icon name="torii" size={24} />
      </span>
      <p className="font-serif text-lg tracking-card text-ink-2">{title}</p>
      {hint ? <p className="max-w-sm text-sm leading-relaxed text-ink-3">{hint}</p> : null}
    </div>
  );
}

/**
 * 首屏 / 懒加载骨架屏（§3.3：只用于这两处，不用来掩盖多次异步往返）。
 *
 * 形状与真实卡片对齐（复用 `CHECKLIST_GRID` + 卡片斜面）：首屏"骨架 → 内容"
 * 只换内部填充、不换几何，避免一次明显的形状跳动。
 */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={CHECKLIST_GRID} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`flex animate-pulse items-start gap-2.5 px-3.5 py-3 ${cardBox.solid}`}>
          <span className="mt-0.5 h-3.5 w-3.5 flex-none rotate-45 border border-line-soft bg-fill" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-1/3 rounded-sm bg-fill-2" />
            <span className="block h-2.5 w-2/3 rounded-sm bg-fill-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 分组头（原 `SectionTitle`）—— 册页稿 `.grp-head`：
 * 周期符（金）+ 衬线组名（**墨色**、字距 .14em）+ 渐隐线拉到右侧 + 等宽计数。
 *
 * 2026-09-24 册页重设计改排：
 *   - 组名由"金字"改回**墨色** —— 分组头是结构不是强调，金只留给符与计数点；
 *     参考稿的 `h2` 就是 `--ink`。
 *   - 虚线 → **渐隐实线**（`.ln`：左实右虚），虚线是"未完成"的暗示，不该出现在结构线上。
 *   - 计数 pill → **裸等宽计数**（`.ct`）：pill 是徽章语言，页面上已有任务名下的
 *     菱形进度格与汇总条的等宽字，这层再包胶囊就过了。
 *   - **进度底轨退场**：页级进度归 `SummaryBar`（参考稿：进度只出现一次）。
 *     `progress` 参数保留但不再渲染，恢复点在 `SummaryBar`。
 */
export function SectionTitle({
  icon,
  children,
  count,
  aside,
  flush = false,
}: {
  icon?: IconName;
  children: ReactNode;
  /** 右侧裸计数（参考稿 `.ct`：等宽 11px、弱化墨） */
  count?: number;
  /** 已不渲染（进度归 `SummaryBar`，见上）—— 参数保留以免调用点连锁改 */
  progress?: number;
  aside?: ReactNode;
  /**
   * 不额外横向内缩 —— 用于**父容器已经内缩过**的页面（设置页容器自带 `px-3.5`）。
   * 清单页则保持默认：那里的父级靠 `CHECKLIST_GRID` 的 `px-3.5` 与标题对齐，
   * 而栅格与标题是两层，必须各自缩一次。
   */
  flush?: boolean;
}) {
  return (
    <div className={`${flush ? '' : 'px-3.5'} pb-1.5 pt-4`}>
      <div className="flex items-center gap-2.5">
        {icon ? <Icon name={icon} size={16} className="text-gold-hi" /> : null}
        <span className="font-serif text-lg font-semibold tracking-group text-ink">{children}</span>
        <i className="h-px min-w-4 flex-1 bg-gradient-to-r from-line to-transparent" />
        {typeof count === 'number' ? (
          <span className="font-mono text-xs tabular-nums tracking-wide text-ink-3">{count}</span>
        ) : null}
        {aside}
      </div>
    </div>
  );
}
