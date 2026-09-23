import type { ReactNode } from 'react';
import Icon from '../icons/Icon';

/**
 * 列表顶部提示条：限时页的「N 个活动在跑」临期预警与「版本 / 赛季按开服锚点重置」提示。
 *
 * **没有 `onClick` 时不再渲染成按钮**（2026-09-11 修正）：此前无条件渲染 `<button>`
 * 并带一个右向箭头，于是纯提示"长得能点、Tab 能聚焦、按下去什么都不发生"
 * —— 假可供性比没有可供性更糟，用户会反复点并怀疑应用坏了。
 *
 * 2026-09-23 换肤：实心浅底块 → 细描边 + 极淡同色底；圆角收方到 `rounded-sm`。
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
      ? 'border-crimson-soft bg-crimson/10 text-crimson'
      : 'border-line bg-gold-soft text-gold-hi';
  const box = `mx-3.5 mt-2.5 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-sm border px-2.5 py-2 text-sm ${style}`;

  if (!onClick) return <div className={box}>{children}</div>;

  return (
    <button type="button" onClick={onClick} className={`${box} cursor-pointer text-left`}>
      <span className="min-w-0 flex-1">{children}</span>
      <Icon name="chevron-right" size={12} className="flex-none" />
    </button>
  );
}
