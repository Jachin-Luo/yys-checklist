import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * 页面头（清单页共用）—— 册页稿里它有**两副面孔**，按断点切换（`useBreakpoint`，
 * 全站唯一分流判据）；四个页面的调用点**一行都不用改**（props 不变）：
 *
 * ## 桌面：书眉（参考稿 `.head`）
 * 衬线大标题（29px，全页唯一）+ 说明；右侧是**全页唯一的倒计时**（等宽、金亮、
 * 左侧一道墨线与正文隔开）。参考稿禁止项里有一条「倒计时只保留一个」——
 * 多个倒计时造成决策瘫痪，这个位置仍是全页唯一的倒计时位：今日页放"距明天 0 点"、
 * 本周放"距下周一"、本月放"距下月 1 日"，限时页不放（它的紧迫度由"剩余天数升序"表达）。
 *
 * ## 移动：金券条（参考稿 `.voucher`，则①「页名进应用栏」的另一半）
 * 页名已经上了应用栏（`MobileShell`），这里不再渲染题头 —— 退化为一条横贯的
 * 金券条：**用途 · 等宽大字 · 绝对时刻**。全页依旧只有它有等宽数字。
 * 没有倒计时的页（限时）只渲染 `action`（筛选入口的落点），页面从正文直接开始。
 *
 * ## 为什么 `action` 插槽两个形态都保留
 *
 * 它是移动端 `ViewBar` 的落点（2026-09-23：一整行只换来一颗按钮，收进页头省一整行）。
 * 桌面端目前没有调用方传它，但插槽留着 —— 恢复筛选时不必回来改四个页面。
 *
 * 日期本身是**自然日历**（纯展示，`domain/dateLabel`），与"还有多久被重置"的
 * 勾选语义不同源 —— 两者在书眉/金券条里并列，正是为了把这件事摆在一处说清。
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
  const variant = useBreakpoint();

  /* ── 移动：金券条 ── */
  if (variant === 'mobile') {
    if (!countdown && !action) return null;
    return (
      <div className="mx-3.5 mt-3 flex items-center gap-2">
        {countdown ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm border border-gold-line/45 bg-gradient-to-r from-gold-soft to-fill px-3 py-2">
            <span className="flex-none text-2xs tracking-label text-gold-hi">{countdownLabel}</span>
            <b className="flex-none font-mono text-base font-semibold tabular-nums text-gold-hi">
              {countdown}
            </b>
            {/* 绝对时刻（"明天 00:00 刷新"）：金券条的第三个槽，窄屏放得下就显示 */}
            {detail ? (
              <span className="ml-auto min-w-0 truncate text-2xs text-ink-3">{detail}</span>
            ) : null}
          </div>
        ) : null}
        {action}
      </div>
    );
  }

  /* ── 桌面：书眉 ── */
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="min-w-0 truncate font-serif text-3xl leading-tight tracking-label text-ink">
            {title}
          </h1>
          {action}
        </div>
        {detail ? <p className="mt-1.5 text-sm text-ink-3">{detail}</p> : null}
        {aside}
      </div>
      {countdown ? (
        <div className="flex-none border-l border-line-soft pl-5 text-right">
          <em className="block text-2xs not-italic tracking-label text-ink-3">{countdownLabel}</em>
          <b className="mt-1 block font-mono text-lg font-semibold tabular-nums text-gold-hi">
            {countdown}
          </b>
        </div>
      ) : null}
    </div>
  );
}
