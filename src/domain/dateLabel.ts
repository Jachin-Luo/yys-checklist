/**
 * 页面顶部日期标签（2026-09-11 用户需求）：今日页 / 本周页顶部展示具体日期。
 *
 * **纯展示、纯函数** —— 与勾选重置（每日 05:00 / 周一 05:00，见 domain/reset）**无关**：
 * 这里跟的是自然日历（自然周周一–周日），给用户"肉眼对表"用的；
 * 重置语义在 domain/reset，两者刻意分离，别把「周一 05:00 重置」混进周区间的算法里。
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 「M月D日」—— 今日页与周区间两端共用同一格式，避免两处各写一份 */
function md(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 今日页标签：`9月11日 周五` */
export function todayDateLabel(now: Date): string {
  return `${md(now)} ${WEEKDAYS[now.getDay()]}`;
}

/**
 * 本周页标签：`9月7日 - 9月13日`。
 * 自然周、**周一为起点**；跨月 / 跨年时两端各自独立格式化（不省略月份），
 * 如 9月29日 - 10月4日、12月28日 - 1月3日。
 */
export function weekRangeLabel(now: Date): string {
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return `${md(monday)} - ${md(sunday)}`;
}
