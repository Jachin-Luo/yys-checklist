import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Icon from '../icons/Icon';

/**
 * 「回到顶部」—— 朱印按钮（参考稿 `uiRef/囤囤鼠大作战_回到顶部按钮.html`）。
 *
 * ## 为什么是「昇雲箭」而不是一支普通上箭头
 *
 * 参考稿把五个方向摆在同一张桌上比（普通上箭头 / 昇雲箭 / 三叠雲 / 雲梯 / 破魔三矢），
 * 判据是固定的：**先看 17px 还能不能认，再看像不像这套界面**。定稿是「云拱托起一支箭」——
 * 箭保证"向上"这条语义不必靠猜，云拱承担和风里的「昇」。图形定义在 `sprite.tsx` 的 `ascend`。
 *
 * ## 什么时候出现（用户口径）
 *
 * 「滚动到非最顶部时出现，在顶部时不用出现」——于是只有两态：
 *
 *   - 滚动量 > `SHOW_AT` → 默认态（显示）；
 *   - 回到顶部 → `.is-hidden`：淡出下沉 + `pointer-events: none`，
 *     并且**同时**摘掉 Tab 与读屏（`tabIndex=-1` + `aria-hidden`）——
 *     一个"看不见却能被 Tab 命中"的按钮是陷阱，不只是视觉问题。
 *
 * ⚠️ 参考稿另画了两个态：**未达阈值**（滚过 320px 才浮出）与**到顶态**（淡到 28%、
 * 留位不重排）。这里**按用户口径取"非最顶部即出现"**，只保留「显示 / 隐藏」两态；
 * 想换成参考稿那套阈值，改 `SHOW_AT` 与 `.is-hidden` 即可 —— 图形与样式都不用动。
 *
 * ## 挂载位置由壳层决定
 *
 * 按钮锚在**滚动容器（`main`）所在的那一层**（各壳层给 `relative` + 偏移类），
 * 而不是 `fixed` 到视口：移动端底栏高度与 iOS 安全区一变，`fixed` 就得跟着改魔数。
 * `position` 与 `z-index` 写在 `.genso-rt` 里（`styles/theme.css`），调用方只给偏移。
 */
const SHOW_AT = 4;

/** 平滑滚动也要让开 `prefers-reduced-motion`：全局 CSS 那条兜底只管 transition/animation */
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function BackToTop({
  target,
  className = '',
}: {
  /** 滚动容器（各壳层的 `main`）——监听它的 `scroll`，也由它执行回到顶部 */
  target: RefObject<HTMLElement | null>;
  /** 只传偏移（如 `bottom-2 right-4`）：`position` 与 `z-index` 在 `.genso-rt` 里 */
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    /* 🚩 `passive`：这个监听只读 `scrollTop`，不该拖住滚动 */
    const sync = () => setShown(el.scrollTop > SHOW_AT);
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    return () => el.removeEventListener('scroll', sync);
  }, [target]);

  /* 点完之后它自己就消失了：若焦点还留在上面，浏览器与读屏都会指着一个已隐藏的元素。
     主动 blur（把它交还给页面），比留着"隐藏但仍聚焦"的按钮干净 */
  useEffect(() => {
    if (shown) return;
    /* `btnRef.current` 与 `document.activeElement` 都可能是 null，而严格相等比较
       **不会**帮 TS 收窄两边 —— 得先把 ref 收进局部变量再判空，`el.blur()` 才不报 TS18047 */
    const el = btnRef.current;
    if (el && el === document.activeElement) el.blur();
  }, [shown]);

  const toTop = useCallback(() => {
    target.current?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [target]);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toTop}
      aria-label="回到顶部"
      title="回到顶部"
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
      className={`genso-rt ${shown ? '' : 'is-hidden'} ${className}`}
    >
      {/* 图标继承 `currentColor`（亮金）且默认 `aria-hidden`：语义由按钮的 `aria-label` 承担，
          不让读屏为同一件事念两遍 */}
      <Icon name="ascend" size={25} />
    </button>
  );
}
