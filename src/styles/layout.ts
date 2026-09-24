/**
 * 清单列表容器类 —— **两端共用同一个值**（设计文档 §8.3：手机与 PC 共享原子件）。
 *
 * ## 2026-09-24 册页重设计：双列卡片 → 通栏账目行（用户决议 5）
 *
 * 行不再自带卡片外框（圆角/阴影/底色由行自己在 hover 与完成态给，见
 * `ChecklistItem` / `ChecklistGroupCard`）；行与行之间由行自己的
 * `border-t border-line-soft first:border-t-0` 分隔 —— 参考稿 `.entry + .entry`。
 * 旧的 `gap-2` 与 `lg:grid-cols-2` 随双列一起退役（双列是 2026-09-11 的用户决策，
 * 本次由用户明确推翻，记录在 `uiRef/册页重设计_落地评估.md` §六）。
 *
 * ## 水平内缩 14px（`px-3.5`）
 *
 * 与 `SectionTitle`、行内 padding 同一口径，所以分区标题的左边界正好对齐账目行。
 * 曾经栅格是 12px、标题是 14px，差 2px —— 这种"说不上哪里脏"的错位最难查。
 */
export const CHECKLIST_GRID = 'grid grid-cols-1 px-3.5 py-1';
