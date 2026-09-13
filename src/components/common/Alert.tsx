import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * 列表顶部提示条：今日页「本周高痛感还剩 N 项」/ 本周页「周一 05:00 重置」。
 *
 * **没有 `onClick` 时不再渲染成按钮**（2026-09-11 修正）：此前无条件渲染 `<button>`
 * 并带一个 `ChevronRight`，于是本周页那条纯提示"长得能点、Tab 能聚焦、按下去什么都不发生"
 * —— 假可供性比没有可供性更糟，用户会反复点并怀疑应用坏了。
 *
 * 水平内缩用 `mx-3.5`(14px)，与 `SectionTitle` / 栅格同一口径。
 */
export default function Alert({
  tone,
  children,
  onClick,
}: {
  tone: 'danger' | 'warn';
  children: ReactNode;
  onClick?: () => void;
}) {
  const style =
    tone === 'danger'
      ? 'border-danger-line bg-danger-soft text-danger'
      : 'border-warn-line bg-warn-soft text-warn';
  const box = `mx-3.5 mt-2.5 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${style}`;

  if (!onClick) return <div className={box}>{children}</div>;

  return (
    <button type="button" onClick={onClick} className={`${box} cursor-pointer text-left`}>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight size={12} className="flex-none" />
    </button>
  );
}
