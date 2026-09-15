import NavContent from '../common/NavContent';
import NurtureBadge from '../common/NurtureBadge';
import ProfileSwitcher from '../common/ProfileSwitcher';
import { useChecklist } from '../../hooks/useChecklist';
import { NAV_ITEMS, useUiStore } from '../../stores/ui';

/**
 * 手机端布局骨架（设计文档 §8.3）。
 * 顶部应用栏 + 细进度条 → 单列内容区 → 底部固定 Tab。
 * 只做排列：数据来自 stores，业务规则在 domain。
 *
 * 2026-09-11 三处真机问题修正：
 *   1. `safe-top` / `safe-x` / `safe-bottom`：`index.html` 开了 `viewport-fit=cover`，
 *      但此前全库零 `env(safe-area-inset-*)` —— 刘海与 Home 指示条区会压住标题行与 Tab；
 *   2. 底部 Tab 的点击热区：`button{padding:0}` 重置 + 原先 `pt-1.5/pb-2` 加在 **nav 容器**上，
 *      于是每个 Tab 的可点区域只有一行文字（约 16px 高），远低于 24px 最低标准；
 *      现在把 `py-2` 给到按钮本身（约 33px）；
 *   3. 视口高度改用 `dvh`（见 `styles/base.css`），地址栏伸缩时底部 Tab 不再被推出可视区。
 */
export default function MobileShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);
  const { pending, done } = useChecklist('today');
  const total = pending.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col bg-surface-2">
      <header className="safe-top safe-x flex-none border-b border-line-soft bg-surface pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 flex-1 truncate text-xl font-medium text-ink">阴阳师查漏清单</h1>
          {/* 与档案切换器同一行：紧凑形态只留「图标 + 剩多久」，完整时刻在 title 里 */}
          <NurtureBadge compact />
          <ProfileSwitcher compact />
        </div>
        <p className="mt-1 text-sm text-ink-3">
          今日 {pending.length} 项待做 · 已完成 {done.length} 项
        </p>
        <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-surface-3">
          <i className="block h-full rounded-sm bg-success transition-all duration-180" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <NavContent variant="mobile" />
      </main>

      <nav className="safe-bottom grid flex-none grid-cols-7 border-t border-line-soft bg-surface pt-1.5">
        {NAV_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNav(key)}
            aria-current={nav === key ? 'page' : undefined}
            className={`cursor-pointer py-2 text-center text-sm transition-colors duration-120 ${
              nav === key ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
