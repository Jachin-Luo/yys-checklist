import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { CHECKLIST_GRID } from '../../styles/layout';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-ink-3">
        <Inbox size={18} />
      </span>
      <p className="text-lg text-ink-2">{title}</p>
      {hint ? <p className="max-w-sm text-sm leading-relaxed text-ink-3">{hint}</p> : null}
    </div>
  );
}

/**
 * 首屏 / 懒加载骨架屏（§3.3：只用于这两处，不用来掩盖多次异步往返）。
 *
 * 2026-09-11 形状对齐真实内容：原来是"单列 + 无边框细行"，而真实清单是
 * "`lg` 起双列 + 带边框卡片"，首屏渲染时会有一次明显的形状跳动。
 * 现在直接复用 `CHECKLIST_GRID` 与卡片外框，骨架 → 内容的过渡只换内部填充、不换几何。
 */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={CHECKLIST_GRID} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-start gap-2.5 rounded-md border border-line-soft bg-surface px-3.5 py-3"
        >
          <span className="h-5 w-5 flex-none rounded-full bg-surface-3" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-1/3 rounded-sm bg-surface-3" />
            <span className="block h-2.5 w-2/3 rounded-sm bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 二级分区标题（"今天该做 · N 项" / "已完成 N 项"）。内缩与栅格、卡片同口径（14px） */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-3.5 pb-1 pt-3">
      <span className="text-sm tracking-wide text-ink-3">{children}</span>
      {aside}
    </div>
  );
}
