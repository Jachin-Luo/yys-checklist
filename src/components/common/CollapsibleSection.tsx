import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * 「我的」页的可折叠分区卡片（所有设置分区的统一外壳）。
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
 */
export interface CollapsibleSectionProps {
  title: string;
  /** 右侧常驻内容：操作按钮或「只读」这类标记 */
  aside?: ReactNode;
  /** 收起时可见的关键结论 */
  summary?: ReactNode;
  children: ReactNode;
  /** 默认展开（个别高频分区用） */
  defaultOpen?: boolean;
  /** 危险分区（清空勾选）走红色边框 */
  tone?: 'normal' | 'danger';
}

export default function CollapsibleSection({
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
      className={`mt-4 overflow-hidden rounded-lg border bg-surface ${
        danger ? 'border-danger-line' : 'border-line-soft'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <ChevronRight
            size={13}
            strokeWidth={2.4}
            className={`flex-none transition-transform duration-120 ${open ? 'rotate-90' : ''} ${
              danger ? 'text-danger' : 'text-ink-4'
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className={`block text-lg ${danger ? 'text-danger' : 'text-ink'}`}>{title}</span>
            {summary ? <span className="mt-0.5 block text-sm text-ink-3">{summary}</span> : null}
          </span>
        </button>
        {aside ? <span className="flex flex-none items-center gap-2">{aside}</span> : null}
      </div>

      <div className={open ? 'border-t border-line-faint' : 'hidden'}>{children}</div>
    </section>
  );
}
