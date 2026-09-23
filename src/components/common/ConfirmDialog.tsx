import Icon from '../icons/Icon';
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
 *
 * 2026-09-23 换肤：遮罩改 `scrim`（暗版更沉）、弹窗改 `surface-3` + 朱印面板投影；
 * 危险动作从"实心朱红块"改成"细描边 + 极淡朱红底"——参考稿禁止用实心色块提密度。
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/60 px-4"
      onClick={() => answer(false)}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={confirmState.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface-3 shadow-panel"
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          {danger ? (
            <Icon name="alert" size={16} className="mt-0.5 flex-none text-crimson" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2
              className={`font-serif text-lg tracking-card ${danger ? 'text-crimson' : 'text-ink'}`}
            >
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
            className="cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-line hover:bg-surface"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className={`cursor-pointer rounded-sm border px-3 py-1.5 text-sm transition-colors duration-120 ${
              danger
                ? 'border-crimson-soft text-crimson hover:bg-crimson/10'
                : 'border-line bg-gold-soft text-gold-hi hover:border-gold-hi'
            }`}
          >
            {confirmState.confirmLabel ?? '确认'}
          </button>
        </footer>
      </div>
    </div>
  );
}
