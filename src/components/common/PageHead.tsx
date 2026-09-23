import type { ReactNode } from 'react';

/**
 * 页面头（清单页共用）—— 朱印的「顶栏」语言：
 * 左侧衬线大标题 + 说明；右侧是**唯一的一个倒计时**（等宽字体、金亮色、上方一道 12px 短金线）。
 *
 * 参考稿禁止项里有一条「倒计时只保留一个」—— 多个倒计时造成决策瘫痪。
 * 因此这个位置是全页唯一的倒计时位：今日页放"距明天 0 点"、本周放"距下周一"、
 * 本月放"距下月 1 日"，限时页不放（它的紧迫度由"剩余天数升序"表达，再叠倒计时就是三处重复）。
 *
 * 日期本身是**自然日历**（纯展示），与"还有多久被重置"的勾选语义不同源 —— 见 `domain/dateLabel`。
 *
 * ## 为什么有 `action` 插槽，且放在**标题同一行**（2026-09-23）
 *
 * 移动端此前把筛选条（`ViewBar`）当成一个独立整行来渲染，而它在窄屏下**只显示一颗"筛选"按钮**
 * —— 一整行加一条分隔线只换来一个 32px 的小按钮，白掉首屏高度。
 *
 * 现在移动端把入口收进页头（`action`），PC 端照旧保留整行（高频 6 类 chip 直接可见）。
 * 插槽**必须与标题同行**：放到下面倒计时那一列里，右列会从两行变成三行，
 * 省下的那一行又被吃回去一半 —— 等于没省。标题行本身很空（"今日"两个字），
 * 塞一颗按钮绰绰有余；`truncate` + `min-w-0` 保证极窄屏下标题先让位、按钮不被挤变形。
 */
export default function PageHead({
  title,
  detail,
  countdown,
  countdownLabel = '重置倒计时',
  aside,
  action,
}: {
  title: string;
  detail?: ReactNode;
  countdown?: string | null;
  countdownLabel?: string;
  /** 标题下方的附加内容（如今日页的达摩） */
  aside?: ReactNode;
  /** 与标题同行的附加控件（移动端的筛选入口）—— 不额外占高度 */
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-3.5 pt-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="min-w-0 truncate font-serif text-xl tracking-title text-ink">{title}</h2>
          {action}
        </div>
        {detail ? <p className="mt-1 text-sm text-ink-3">{detail}</p> : null}
        {aside}
      </div>
      {countdown ? (
        <div className="flex-none text-right">
          <i className="mb-1.5 ml-auto block h-px w-3 bg-line" />
          <p className="text-2xs tracking-label text-ink-3">{countdownLabel}</p>
          <p className="mt-0.5 font-mono text-lg text-gold-hi">{countdown}</p>
        </div>
      ) : null}
    </div>
  );
}
