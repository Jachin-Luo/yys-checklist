import { useEffect, useRef } from 'react';

/** 可聚焦元素选择器（弹层内 Tab 循环用） */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 弹层焦点管理（2026-09-11 新增）—— `ConfirmDialog` 与 `OnboardingDialog` 共用。
 *
 * 此前两个弹层都设了 `aria-modal="true"`，但那只约束辅助技术的朗读范围，**不拦键盘**：
 *   1. 打开时不移入焦点 → 读屏用户仍停在背后的页面上，以为没弹出东西；
 *   2. 不锁 Tab → 能 Tab 到背后的导航与清单上，焦点跑到看不见的地方（键盘黑洞）；
 *   3. 关闭后不还焦 → 焦点落回 `body`，继续 Tab 会从页面开头重来。
 *
 * `Escape` 由调用方决定是否处理：确认弹窗该关，**引导弹窗不该关** ——
 * 按一下 Esc 就静默跳过引导、还写掉 `onboarded` 标记，代价太大。
 *
 * @param open 弹层是否可见。组件常在未打开时 `return null`，此处必须显式传：
 *             若只靠 ref 判断，effect 不会重跑，焦点就永远不会被移入。
 * @param onEscape 传了才响应 Escape。
 */
export function useModalFocus(open: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  /* 用 ref 存回调：调用方若传内联箭头函数，直接进依赖数组会让 effect 每次渲染都重跑（焦点被反复重置） */
  const escRef = useRef<(() => void) | undefined>(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return undefined;
    const prev = document.activeElement as HTMLElement | null;

    /* `offsetParent` 为 null 的是 `display:none` 的元素（折叠区里藏着的按钮不该进循环） */
    const items = () =>
      [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    /* 1. 移入焦点：优先第一个可聚焦元素（确认弹窗里正好是「取消」= 更安全的一侧） */
    (items()[0] ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escRef.current) {
        e.preventDefault();
        escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      /* 2. 首尾回环，把焦点锁在弹层内 */
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      /* 3. 还焦。判 `isConnected`：元素可能已被删掉（例如"删完这条就把弹窗关了"） */
      if (prev?.isConnected) prev.focus();
    };
  }, [open]);

  return ref;
}
