import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 长按手势（清单条目的「跨账号勾选」用）。
 *
 * ## 为什么必须自己写
 *
 * 卡片本身「整卡点击 = 勾选」（产品决策），长按要在同一个元素上叠一层，两者必须互不干扰。
 * 三条规则都不能省：
 *
 *   1. **位移即取消**：触摸列表里"按住"和"开始滚动"的起始动作一模一样，
 *      不给位移设阈值（默认 8px）会把每一次滚动都变成一次长按；
 *   2. **触发后吞掉尾随 click**：`pointerup` 之后浏览器仍会派发一次 `click`，
 *      不吞掉的话用户"长按选账号"会顺手把**当前账号**也勾上 —— 这是最隐蔽的一类 bug；
 *   3. **右键直接触发**（PC，2026-09-16 用户确认要支持）：右键本身已是明确意图，
 *      不用等 500ms，也不该走进度条 —— 那只会让"按下到弹层"多出一次无谓等待。
 *
 * ## 视觉反馈
 *
 * hook 只暴露 `pressing` 状态（"正按住、尚未达成"），样式留在调用方 ——
 * 它对"长按"这件事是通用的，不该内嵌某张卡片的样式。
 * 达成时顺带触发一次短震动（`navigator.vibrate` 在 iOS Safari 不存在，静默跳过），
 * 让"手指遮住屏幕"的情况下也能确认操作已生效。
 */
export const LONG_PRESS_MS = 500;
/** 按住途中的位移容差：超过它视为滚动，取消长按 */
const MOVE_TOLERANCE = 8;

export interface LongPressOptions {
  onLongPress: () => void;
  /** 按住多久算长按。与调用方的进度条动画时长必须一致，否则视觉与行为会错位 */
  duration?: number;
  /**
   * false = 完全不启用（连按压态都不进，右键也不接管）。
   *
   * 用于"这张卡片的勾选有自己的语义、不适合跨账号复制"的场景。
   * **当前所有调用点都是启用**（一键日常入口改成级联版跨账号写入后，
   * 不再需要禁用它，见 `stores/check.toggleInProfiles` 的注释）——
   * 保留这个开关是为了这类需求再现时不必回头改 hook。
   */
  enabled?: boolean;
}

export interface LongPressResult {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  /** 正在按住（未达成）—— 调用方据此渲染按压态与进度条 */
  pressing: boolean;
  /**
   * 长按**刚触发过** → 这次 click 是它的副作用，调用方应直接 return。
   * **读取即清除**：只需在点击处理的开头调用一次。
   */
  swallowClick: () => boolean;
}

export function useLongPress({
  onLongPress,
  duration = LONG_PRESS_MS,
  enabled = true,
}: LongPressOptions): LongPressResult {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    setPressing(false);
  }, []);

  /* 卸载时清定时器：长按到一半切页（比如点了徽章跳走）不该再弹层 */
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      /* 只认主键与主指针：右键走 onContextMenu，中键 / 多指不参与 */
      if (e.button !== 0 || !e.isPrimary) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        setPressing(false);
        if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
        onLongPress();
      }, duration);
    },
    [duration, enabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origin.current) return;
      const moved = Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y);
      if (moved > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  const swallowClick = useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      /* 右键的浏览器菜单在这里没有用武之地，直接换成我们的选择器 */
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
    [cancel, enabled, onLongPress],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu },
    pressing,
    swallowClick,
  };
}
