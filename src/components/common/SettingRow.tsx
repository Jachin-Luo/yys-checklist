import type { ReactNode } from 'react';

import { cardBox } from './controls';

/**
 * 设置行 —— **复用任务卡的同一套材质**，不新造一种卡片。
 *
 * ```
 * background-color: var(--card)  →  bg-surface（纯白浮起）
 * box-shadow: var(--sh-card)     →  shadow-card
 * border-radius: var(--r-md)     →  rounded-md（2026-09-24 起 14px）
 * padding: 12px 16px             →  px-4 py-3
 * 行间距                          →  由父级 space-y-1.5 统一控制
 * ```
 *
 * 左侧是「衬线标题 13px + 说明 12px 弱化色」，右侧控件 `flex:none` ——
 * 与清单卡是同一个"盒子"，只换了内部布局。这样设置页不需要第二套卡片语言。
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
    <div className={`px-4 py-3 ${cardBox.solid}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base tracking-card text-ink">{title}</p>
          {desc ? <p className="mt-1 text-sm leading-relaxed text-ink-3">{desc}</p> : null}
        </div>
        {control ? <div className="flex flex-none items-center gap-2">{control}</div> : null}
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}
