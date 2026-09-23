import { useEffect, useMemo, useState } from 'react';
import Icon from '../icons/Icon';
import { useModalFocus } from '../../hooks/useModalFocus';
import { aliveProfiles, useSessionStore } from '../../stores/session';
import { useUiStore } from '../../stores/ui';

/**
 * 「同时勾选到其他账号」选择器（清单条目**长按**触发，2026-09-16 用户需求）。
 *
 * 动机：多个号常常要做同一件事（同一个寮的活动、同一天的两个号日常）。
 * 与其切号重勾一遍，不如长按一次把这条也算到别的号上。
 *
 * ## 三条设计约束
 *
 * 1. **默认一个都不选**：不勾就不点确认 → 零误写。相比之下"默认全选其他账号"
 *    设计上一个手滑就把所有号都标记成已完成，而勾选是用户唯一无法重建的数据；
 * 2. **记忆上次选择**：只存在内存里（模块级变量，不落盘、不进备份）——
 *    它是"刚刚那次操作选了谁"，不是配置；
 * 3. **当前账号只读展示**：它一定被写入（走正常路径），但不给切换 ——
 *    这里的选择器语义是"**另外**算到哪些号上"，把当前账号做成可取消的复选框
 *    会让"我点的时候它是什么状态"变得难以理解。
 *
 * 弹窗本体挂在 `App` 顶层（与 `ConfirmDialog` 同一位置），调用点只 `await askPick(...)`。
 *
 * ## 2026-09-23 换肤修正：弹窗不再糊成一整块重色
 *
 * 上一版外壳写的是 `bg-surface`（= `--c-card`，明版 `#E3D7C1`）—— 那比它底下的页面底
 * `--c-panel`（`#F5EFE3`）还**暗**，浮起方向反了，于是从页头到页脚整块糊成一片深纸色，
 * 看起来就是"一个很重的颜色"。正确口径与 `ConfirmDialog` / `ProfileSwitcher` 下拉一致：
 * **弹层底走 `surface-3` + `shadow-panel`**，只有"卡片 / 行 / 输入框"才用 `surface` ——
 * 明版往下压、暗版往上提，永远背离底色（见 `styles/theme.css` 铁律三）。
 *
 * 同批修掉三处小病：标题补上衬线（`font-serif tracking-card`，与其它弹窗同形）；
 * 「取消」按钮的 `hover:border-line` 与自身边框同色、是个空转的 hover，改成 `hover:bg-surface`；
 * 勾选指示器由方框改为**菱形符格**，与清单卡的勾选控件同形状语言。
 */
let lastPicked: string[] = [];

export default function ProfilePickDialog() {
  const pickState = useUiStore((s) => s.pickState);
  const answerPick = useUiStore((s) => s.answerPick);
  const session = useSessionStore((s) => s.session);
  const profiles = useSessionStore((s) => s.profiles);
  const [selected, setSelected] = useState<string[]>([]);

  /* 候选 = 未归档的其他账号。归档的不出现在任何日常入口，这里也不例外 */
  const others = useMemo(
    () => aliveProfiles(profiles).filter((p) => p.id !== session?.profileId),
    [profiles, session?.profileId],
  );
  const currentName = useMemo(
    () => profiles.find((p) => p.id === session?.profileId)?.name ?? '当前账号',
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/60 px-4"
      onClick={() => answerPick(null)}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${action}其他账号的完成状态`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface-3 shadow-panel"
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          <Icon name="kasane" size={16} className="mt-0.5 flex-none text-gold" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg tracking-card text-ink">同时{action}到其他账号</h2>
            <p className="mt-1 truncate text-sm text-ink-2" title={pickState.itemName}>
              「{pickState.itemName}」
            </p>
          </div>
        </div>

        <div className="border-t border-line-faint px-4 py-2.5">
          {/* 当前账号做成一条「压上来的纸片」（`bg-surface` 浮在面板底上）：
              它与下方可选的账号行在**材质上就分出"只读 / 可点"两档**，
              不需要靠一行小字去解释"它为什么不能点"。 */}
          <div className="flex items-center gap-2 rounded-sm bg-surface px-2.5 py-2 text-sm text-ink-3 shadow-card">
            <Icon name="check" size={12} className="flex-none text-crimson" />
            <span className="min-w-0 truncate">
              当前：<b className="font-medium text-ink">{currentName}</b>
              {pickState.checked ? '（已完成，将一并取消）' : '（将标记为已完成）'}
            </span>
          </div>

          {others.length ? (
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {others.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors duration-120 ${
                      /* `ring-inset`：列表在 `overflow-y-auto` 里，非内嵌的 ring 会被容器裁掉 1px */
                      on ? 'bg-gold-soft text-gold-hi ring-1 ring-inset ring-line' : 'text-ink hover:bg-surface'
                    }`}
                  >
                    {/* 菱形符格（与清单卡勾选控件同一形状语言：金描边空心 → 朱红实心）。
                        这里是**行内指示器**而不是嵌套按钮 —— 行本身已是 `button`，
                        再套一层会产出非法 HTML；点击与键盘由行自己承担。 */}
                    <span className="flex h-4 w-4 flex-none items-center justify-center">
                      <i
                        className={`block h-2.5 w-2.5 rotate-45 border transition-colors duration-220 ease-genso ${
                          on ? 'border-crimson bg-crimson' : 'border-gold'
                        }`}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-serif text-base tracking-card">
                      {p.name}
                    </span>
                    {p.server ? <span className="flex-none text-sm text-ink-3">{p.server}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-sm leading-relaxed text-ink-3">
              没有其他账号可同步。在「设置 → 账号管理」里新建一个后即可使用。
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line-faint px-4 py-2.5">
          <button
            type="button"
            onClick={() => answerPick(null)}
            className="cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:bg-surface"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selected.length}
            onClick={confirm}
            className="cursor-pointer rounded-sm border border-line bg-gold-soft px-3 py-1.5 text-sm text-gold-hi transition-colors duration-120 hover:border-gold-hi disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected.length
              ? `${action}到 ${selected.length} 个账号`
              : `请选择账号`}
          </button>
        </footer>
      </div>
    </div>
  );
}
