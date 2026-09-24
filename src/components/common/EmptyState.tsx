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
 * 分组头（原 `SectionTitle`）—— 朱印的分区语言：
 * 组名图标 + 衬线组名（金色、字距 .2em） + 一条虚线拉到右侧 + 计数 pill。
 *
 * 2026-09-23 重做：上一版是一行 12px 灰字"今天该做 · 3 项"，把"是什么组"
 * 和"有几项"揉在一句里；现在拆成 组名 / 计数 两个信息位，与参考稿一致。
 *
 * `progress` 是**真实进度**（已完成 / 总数），渲染为 2px 底轨。
 * 注意参考稿的硬约束：底轨**不得超过 2px**，超过就变成第二根分隔线。
 * 本项目数据是布尔勾选、没有 `cur/total`，所以进度只做在"分组"这一层，
 * 不伪造单条目的次数进度。
 */
export function SectionTitle({
  icon,
  children,
  count,
  progress,
  aside,
  flush = false,
}: {
  icon?: IconName;
  children: ReactNode;
  /** 右侧计数 pill（参考稿：金描边胶囊、等宽 10px） */
  count?: number;
  /** 0–1；给了才画 2px 底轨 */
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
        <span className="font-serif text-sm tracking-group text-gold-hi">{children}</span>
        <i className="h-0 min-w-4 flex-1 border-t border-dashed border-line-soft" />
        {typeof count === 'number' ? (
          <span className="rounded-full border border-line px-2 py-0.5 text-center font-mono text-2xs tracking-wide text-gold-hi">
            {String(count).padStart(2, '0')}
          </span>
        ) : null}
        {aside}
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-2 h-0.5 w-full overflow-hidden bg-track">
          <i
            className="block h-full bg-crimson transition-all duration-350 ease-genso"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
