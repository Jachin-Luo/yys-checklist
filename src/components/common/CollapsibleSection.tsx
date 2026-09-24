import { useState, type ReactNode } from 'react';
import Icon from '../icons/Icon';

/**
 * 「设置」页的可折叠分区卡片（所有设置分区的统一外壳）。
 *
 * 三条约定（改这一处就全局一致）：
 *
 * 1. **默认收起**。设置项多且低频，全展开会让用户每次进来都要跨过一大片内容才能找到目标。
 *    但收起不等于丢信息 —— **关键结论放 `summary`**（"已覆盖 12 项"、"存活 2 个"），
 *    用户不展开也能确认状态。
 *
 * 2. **`aside` 不嵌套进标题按钮**。它常放操作按钮（"恢复默认条目库"），
 *    若把整个标题做成 `<button>` 就会出现 button 套 button —— 非法 HTML 且点击行为错乱。
 *    因此标题区与 aside 区是两个并列的兄弟节点。
 *
 * 3. **收起时不卸载子内容**（CSS `hidden` 而非条件渲染）。因为分区里有表单草稿
 *    （条目添加框、备份文本框）—— 收起一下就把用户输入清空是不可接受的。
 *    代价是 CSS 隐藏的元素仍在 DOM 里，这些分区都很轻，可以接受。
 *
  * 2026-09-23 换肤：展开箭头换成和风折角、标题改衬线（与分组头同一套语言）。
 *
 * ## 与 `SettingRow` 的关系（2026-09-23 设置页重构）
 *
 * 两者用**同一套材质**（`bg-surface` + `shadow-card` + `rounded-md`），区别只在用途：
 *   - `SettingRow`：简单设置一行说完 → 平铺、不折叠；
 *   - `CollapsibleSection`：长列表 / 表单（条目库、覆盖清单、账号列表、寮时间逐条、备份文本框）
 *     → 默认收起，靠 `summary` 在不展开时也能看到关键结论。
 * 行间距由父级的 `space-y-1.5` 统一给，所以这里**不再自带 `mt-4`**。
 */
export interface CollapsibleSectionProps {
  /** 供锚点跳转用的 DOM id（例如今日页入口卡的「去设置」跳过来后滚动定位到本分区） */
  id?: string;
  title: string;
  /** 右侧常驻内容：操作按钮或「只读」这类标记 */
  aside?: ReactNode;
  /** 收起时可见的关键结论 */
  summary?: ReactNode;
  children: ReactNode;
  /** 默认展开（个别高频分区用） */
  defaultOpen?: boolean;
  /** 危险分区（清空勾选）走朱红边框 */
  tone?: 'normal' | 'danger';
}

export default function CollapsibleSection({
  id,
  title,
  aside,
  summary,
  children,
  defaultOpen = false,
  tone = 'normal',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const danger = tone === 'danger';

  return (
    <section
      id={id}
      className={`overflow-hidden rounded-md border bg-surface shadow-card ${
        danger ? 'border-crimson-soft' : 'border-line-soft'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <Icon
            name="chevron-right"
            size={13}
            className={`transition-transform duration-120 ${open ? 'rotate-90' : ''} ${
              danger ? 'text-crimson' : 'text-gold-hi'
            }`}
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block font-serif text-base tracking-card ${
                danger ? 'text-crimson' : 'text-ink'
              }`}
            >
              {title}
            </span>
            {summary ? <span className="mt-1 block text-sm text-ink-3">{summary}</span> : null}
          </span>
        </button>
        {aside ? <span className="flex flex-none items-center gap-2">{aside}</span> : null}
      </div>

      <div className={open ? 'border-t border-line-faint' : 'hidden'}>{children}</div>
    </section>
  );
}
