import type { ReactNode } from 'react';

/**
 * 设置行（册页稿 `.srow`）—— 设置页的"一行一事"：
 * 左侧「标题 + 说明」、右侧控件，行与行之间用 8px 间隙（父级 `space-y-2`）。
 *
 * ## 2026-09-24 册页重设计改排
 *
 *   - **卡片材质换底**：`cardBox.solid`（阴影浮起）→ `bg-surface + border-line-faint`
 *     （描边平贴，参考稿 `.srow` 没有阴影 —— 设置行是"账本里的一行"，不是"浮起的一张卡"；
 *     阴影留给清单页与弹层）。
 *   - **标题回到正体**：衬线 → sans 13px 半粗（参考稿 `.srow .tx b` 是 sans 600）——
 *     衬线在册页稿里只给页面题名、分组名与收益数字，设置项是操作入口不是展品。
 *   - **说明压到 11px**（`.tx p`）：它是注脚不是正文。
 *
 * `children` 用于**挂在行下方的附属内容**（如数据版本的键值明细）：
 * 它们与标题同属一个信息单元，拆成两张卡反而会被误读成两件独立的事。
 */
export default function SettingRow({
  title,
  desc,
  control,
  children,
}: {
  title: string;
  /** 一行说明；内容可随状态变化（如"已隐藏 3 项 · 简要"） */
  desc?: ReactNode;
  /** 右侧控件（分段 / 开关 / 按钮…） */
  control?: ReactNode;
  /** 行下方的附属内容 */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-sm border border-line-faint bg-surface px-4 py-3 transition-colors duration-150 ease-genso hover:border-line-soft">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-wide text-ink">{title}</p>
          {desc ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{desc}</p> : null}
        </div>
        {control ? <div className="flex flex-none items-center gap-2">{control}</div> : null}
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}
