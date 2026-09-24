import type { CSSProperties } from 'react';

/**
 * 和风图标引用点。
 *
 * 图标本体定义在 `sprite.tsx`（<symbol> 一次性挂在文档里），这里只做 `<use>`，
 * 所以几百处引用不会各自复制一份路径数据。
 *
 * 默认 `size=16`、颜色继承 `currentColor`：
 *   - 语义着色一律用调用方的 `text-*` 类（如 `text-gold` / `text-ink-4`）；
 *   - 基准尺寸按参考稿：任务类型图标 17、分组头 16、导航 16、统计卡 14、微标记 12/10。
 */
export type IconName =
  /* A1 · 基础印记 */
  | 'seimei'
  | 'star5'
  | 'rhomb'
  | 'grip'
  /* A2 · 周期器物 */
  | 'ema'
  | 'ougi'
  | 'koyomi'
  | 'chochin'
  | 'ofuda'
  | 'nobori'
  /* A3 · 页面导航 */
  | 'chart'
  | 'kanazuchi'
  | 'setting'
  /* B1 · 字段 */
  | 'torii'
  | 'joumae'
  | 'fumi'
  | 'tokei'
  | 'makimono'
  /* B2 · 状态 */
  | 'check'
  | 'alert'
  | 'done'
  | 'sunabochi'
  | 'daruma'
  | 'pin'
  /* C1 · 操作 */
  | 'ascend'
  | 'plus'
  | 'trash'
  | 'fude'
  | 'hako'
  | 'hito'
  | 'kasane'
  | 'suzu'
  | 'undo'
  | 'restore'
  | 'refresh'
  | 'sougo'
  | 'search'
  | 'filter'
  | 'close'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'sun'
  | 'moon'
  /* C2 · 装饰 */
  | 'shimenawa';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /**
   * 有语义时才传：传了会渲染 `<title>` 并去掉 `aria-hidden`。
   * 纯装饰（旁边已有文字）一律不传 —— 否则读屏会把同一件事念两遍。
   */
  title?: string;
  /** 允许调用方做旋转（如 `transform: rotate(90deg)`）这类无法用类的动态值 */
  style?: CSSProperties;
}

export default function Icon({ name, size = 16, className = '', title, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`flex-none ${className}`}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`#g-${name}`} width={24} height={24} />
    </svg>
  );
}
