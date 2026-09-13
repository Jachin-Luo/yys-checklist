import { AlertTriangle } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useUiStore } from '../../stores/ui';

/**
 * 通用二次确认弹窗（删档 / 归档 / 恢复默认条目库 / 清空勾选）。
 *
 * 用法只需一行：`if (await askConfirm({ title: '…' })) { … }`
 * —— 弹窗本体挂在 `App` 顶层，调用点不持有任何弹窗状态。
 * 不再使用原生 `window.confirm`：它会阻塞渲染线程、无法用令牌统一视觉，
 * 也无法表达「危险操作」与「普通确认」的区别。
 *
 * 2026-09-11 补上弹层焦点管理（此前只有 `aria-modal`，那只管朗读范围、不拦键盘）：
 * 打开时焦点移入（落在「取消」= 更安全的一侧，避免一个回车就把东西删了）、
 * Tab 锁在弹层内、Escape 关闭、关闭后还焦。点遮罩仍然关闭。
 */
export default function ConfirmDialog() {
  const confirmState = useUiStore((s) => s.confirmState);
  const answer = useUiStore((s) => s.answerConfirm);
  /* 未打开时组件 `return null`，所以"是否可见"必须显式传进去，否则 effect 不会重跑 */
  const ref = useModalFocus(Boolean(confirmState), () => answer(false));

  if (!confirmState) return null;

  const danger = confirmState.tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-4"
      onClick={() => answer(false)}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={confirmState.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          {danger ? (
            <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 flex-none text-danger" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className={`text-lg font-medium ${danger ? 'text-danger' : 'text-ink'}`}>
              {confirmState.title}
            </h2>
            {confirmState.body ? (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{confirmState.body}</p>
            ) : null}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line-faint px-4 py-2.5">
          <button
            type="button"
            onClick={() => answer(false)}
            className="cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className={`cursor-pointer rounded-sm px-3 py-1.5 text-sm text-white transition-colors duration-120 ${
              danger ? 'bg-danger hover:opacity-90' : 'bg-brand hover:bg-brand-deep'
            }`}
          >
            {confirmState.confirmLabel ?? '确认'}
          </button>
        </footer>
      </div>
    </div>
  );
}
