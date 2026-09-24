/**
 * 汇总条（册页稿 `.summary`）—— 每个清单页正文的第一行：
 * **待办 N · 已成 N · 进度轨 · 口径小字**。
 *
 * 它取代了分组头上的 2px 进度底轨 —— "整体走到哪了"是**页**级信息，
 * 之前放在每个分组头下，同一页两组就出现两条进度轨（参考稿禁止项：
 * "进度只出现一次"）；现在页级进度归汇总条，分组头只留组名与计数。
 *
 * `note` 是各页自己的口径小字（今日"零点结账" / 本周"周一清空" / 本月"翻页即结账" /
 * 限时"到期即归档"）—— 与倒计时、勾选语义的对应关系见各页注释。
 */
export default function SummaryBar({
  pending,
  done,
  note,
  className = '',
}: {
  pending: number;
  done: number;
  note?: string;
  className?: string;
}) {
  const total = pending + done;
  const pct = total ? Math.round((done / total) * 1000) / 10 : 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-sm border border-line-faint bg-fill px-4 py-3 ${className}`}
    >
      <div className="flex items-baseline gap-1.5">
        <b className="font-serif text-2xl font-semibold leading-none tabular-nums text-ink">{pending}</b>
        <span className="text-xs tracking-wide text-ink-3">待办</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <b className="font-serif text-2xl font-semibold leading-none tabular-nums text-ink">{done}</b>
        <span className="text-xs tracking-wide text-ink-3">已成</span>
      </div>
      {/* 进度轨：金线 → 金的横向渐变（参考稿 `.track i`）。
          `role="img"` + aria-label 让读屏拿到百分比，而不是读一段没有意义的图形 */}
      <div
        role="img"
        aria-label={`完成 ${pct}%`}
        className="h-1 min-w-28 flex-1 overflow-hidden rounded-full bg-track"
      >
        <i
          className="block h-full rounded-full bg-gradient-to-r from-gold-line to-gold transition-[width] duration-350 ease-genso"
          style={{ width: `${pct}%` }}
        />
      </div>
      {note ? <span className="text-xs text-ink-3">{note}</span> : null}
    </div>
  );
}
