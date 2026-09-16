import { useEffect, useMemo, useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { aliveProfiles, useSessionStore } from '../../stores/session';
import { useUiStore } from '../../stores/ui';

/**
 * 「同时勾选到其他档案」选择器（清单条目**长按**触发，2026-09-16 用户需求）。
 *
 * 动机：多个号常常要做同一件事（同一个寮的活动、同一天的两个号日常）。
 * 与其切号重勾一遍，不如长按一次把这条也算到别的号上。
 *
 * ## 三条设计约束
 *
 * 1. **默认一个都不选**：不勾就不点确认 → 零误写。相比之下"默认全选其他档案"
 *    设计上一个手滑就把所有号都标记成已完成，而勾选是用户唯一无法重建的数据；
 * 2. **记忆上次选择**：只存在内存里（模块级变量，不落盘、不进备份）——
 *    它是"刚刚那次操作选了谁"，不是配置；
 * 3. **当前档案只读展示**：它一定被写入（走正常路径），但不给切换 ——
 *    这里的选择器语义是"**另外**算到哪些号上"，把当前档案做成可取消的复选框
 *    会让"我点的时候它是什么状态"变得难以理解。
 *
 * 弹窗本体挂在 `App` 顶层（与 `ConfirmDialog` 同一位置），调用点只 `await askPick(...)`。
 */
let lastPicked: string[] = [];

export default function ProfilePickDialog() {
  const pickState = useUiStore((s) => s.pickState);
  const answerPick = useUiStore((s) => s.answerPick);
  const session = useSessionStore((s) => s.session);
  const profiles = useSessionStore((s) => s.profiles);
  const [selected, setSelected] = useState<string[]>([]);

  /* 候选 = 未归档的其他档案。归档的不出现在任何日常入口，这里也不例外 */
  const others = useMemo(
    () => aliveProfiles(profiles).filter((p) => p.id !== session?.profileId),
    [profiles, session?.profileId],
  );
  const currentName = useMemo(
    () => profiles.find((p) => p.id === session?.profileId)?.name ?? '当前档案',
    [profiles, session?.profileId],
  );

  /* 未打开时组件 `return null`，所以"是否可见"必须显式传进去，否则 effect 不会重跑 */
  const ref = useModalFocus(Boolean(pickState), () => answerPick(null));

  useEffect(() => {
    if (!pickState) return;
    const available = new Set(others.map((p) => p.id));
    setSelected(lastPicked.filter((id) => available.has(id)));
  }, [pickState, others]);

  if (!pickState) return null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirm = () => {
    lastPicked = selected;
    answerPick(selected);
  };

  const action = pickState.checked ? '取消' : '勾选';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-4"
      onClick={() => answerPick(null)}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${action}其他档案的完成状态`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          <Layers size={16} strokeWidth={2} className="mt-0.5 flex-none text-brand" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-ink">
              同时{action}到其他档案
            </h2>
            <p className="mt-1 truncate text-sm text-ink-2" title={pickState.itemName}>
              「{pickState.itemName}」
            </p>
          </div>
        </div>

        <div className="border-t border-line-faint px-4 py-2.5">
          <div className="flex items-center gap-2 py-1.5 text-sm text-ink-3">
            <Check size={12} strokeWidth={2.6} className="flex-none text-ink-4" />
            <span className="min-w-0 truncate">
              当前：<b className="font-medium text-ink-2">{currentName}</b>
              {pickState.checked ? '（已完成，将一并取消）' : '（将标记为已完成）'}
            </span>
          </div>

          {others.length ? (
            <div className="mt-1 max-h-64 overflow-y-auto">
              {others.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-left text-lg transition-colors duration-120 ${
                      on ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-3'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded-sm border ${
                        on ? 'border-brand bg-brand text-white' : 'border-line'
                      }`}
                    >
                      {on ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.server ? <span className="flex-none text-sm text-ink-3">{p.server}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-sm leading-relaxed text-ink-3">
              没有其他档案可同步。在「我的 → 档案管理」里新建一个后即可使用。
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line-faint px-4 py-2.5">
          <button
            type="button"
            onClick={() => answerPick(null)}
            className="cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selected.length}
            onClick={confirm}
            className="cursor-pointer rounded-sm bg-brand px-3 py-1.5 text-sm text-white transition-colors duration-120 hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected.length
              ? `${action}到 ${selected.length} 个档案`
              : `请选择档案`}
          </button>
        </footer>
      </div>
    </div>
  );
}
