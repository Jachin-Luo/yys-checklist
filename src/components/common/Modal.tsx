import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon, { type IconName } from '../icons/Icon';
import { useModalFocus } from '../../hooks/useModalFocus';

/**
 * 弹层外壳（2026-09-28 抽出）—— 全站弹窗共用的那一套骨架：
 * 毛玻璃遮罩 + 面板 + 标题栏 + 主体 + 页脚 + 焦点管理（移入 / Tab 锁在层内 / Escape / 还焦）。
 *
 * ## 为什么要抽
 *
 * 抽出来之前，「确认弹窗」与「账号勾选弹窗」各写了一遍这段结构（类串一字不差），
 * 而条目管理的「新建 / 编辑」要成为第三处 —— 同一套材质抄三遍，
 * 参考稿一改就要改三处、且必然漏一处（`controls.ts` 开头那条教训的同一种）。
 *
 * 结构与类串**照抄 `ConfirmDialog`**（那一版是参考稿校准过的），所以视觉零变化：
 * 遮罩 `bg-scrim/60` + `backdrop-blur-sm`、面板 `rounded-2xl border-line bg-surface-3 shadow-panel`、
 * 标题衬线 18px、页脚 `border-t`。
 *
 * ## 调用方要管什么
 *
 * 只管内容与按钮：`children` 是主体，`footer` 是底部按钮条（省略则不渲染页脚）。
 * 关闭路径（Escape / 点遮罩）由 `onClose` 决定 —— **不传就不可关**（引导弹窗那种必须走完的场景）。
 * 焦点管理不必调用方操心：打开时移入第一个可聚焦元素（确认弹窗里正好是「取消」= 更安全的一侧；
 * 表单弹窗里正好是第一个输入框），关闭后还焦。
 *
 * ## 为什么渲染到 `document.body`（portal）
 *
 * 前两个弹窗挂在 `App` 顶层，四周是干净的；而「条目管理」的弹窗长在设置页里 ——
 * 它的祖先有滚动容器（`main` 的 `overflow-y-auto`），将来也难保没有 `transform` / `filter`
 * （那两者会成为 `fixed` 的包含块，遮罩就会**只盖住内容区**甚至被裁掉一块）。
 * `createPortal` 让弹层直接挂在 `body` 下，这一类陷阱一次性消失，调用方也不必关心自己长在哪儿。
 */
export default function Modal({
  title,
  desc,
  icon,
  danger = false,
  size = 'sm',
  scroll = false,
  onClose,
  footer,
  children,
}: {
  /** 面板标题（同时作为 `aria-label`，故为字符串） */
  title: string;
  /** 标题下的说明：**缩进在标题同一块里**（与标题共用一个左缘，读起来是一件事） */
  desc?: ReactNode;
  icon?: IconName;
  /** 危险语气：标题转朱红 */
  danger?: boolean;
  size?: 'sm' | 'lg';
  /**
   * 主体限高可滚（长表单 / 长列表）：面板整体 `max-h-full` + 主体 `overflow-y-auto`，
   * 于是**页脚始终可见** —— 表单一长，"保存"被顶到屏幕外是最常见的可用性问题。
   */
  scroll?: boolean;
  onClose?: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  /* 组件只在打开时渲染，所以 `open` 恒为 `true`（hook 需要这个显式值来跑 effect） */
  const ref = useModalFocus(true, onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-3 shadow-panel ${
          size === 'lg' ? 'max-w-lg' : 'max-w-sm'
        }`}
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          {icon ? (
            <Icon
              name={icon}
              size={16}
              className={`mt-0.5 flex-none ${danger ? 'text-crimson' : 'text-gold-hi'}`}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className={`font-serif text-lg tracking-card ${danger ? 'text-crimson' : 'text-ink'}`}>
              {title}
            </h2>
            {desc ? <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{desc}</div> : null}
          </div>
        </div>

        {children ? (
          <div className={`min-h-0 flex-1 px-4 pb-3.5 ${scroll ? 'overflow-y-auto' : ''}`}>{children}</div>
        ) : null}

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line-faint px-4 py-2.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
