/**
 * 分组序号发生器（参考稿 `.grp-head .no`：`壹 / 贰 / 叁 …`）。
 *
 * ```tsx
 * const no = sectionNo();                       // 页面组件体内
 * <SectionTitle no={no()}>今天该做</SectionTitle>
 * ```
 *
 * 为什么**按调用顺序**发号、而不是各调用点写死：分组是**条件渲染**的（"已结"、
 * "已结"、限时页的"已结"、寄养的"计划清单"）—— 写死就会出现「壹 → 叁」的跳号，
 * 而跳号在这套语言里读起来不是"少了一节"，是"这一页坏了"。
 * 每次渲染都会新建一个发生器，所以布局重算时序号不会累积错位。
 *
 * 单独成一个文件、而不是挂在 `EmptyState.tsx` 里：那边只应导出组件，
 * 掺一个普通函数会让整个文件的 Fast Refresh 失效
 * （eslint `react-refresh/only-export-components` 会直接点出来）。
 */

/** 序号字：十节以内够用，超出回落到阿拉伯数字 */
const GROUP_NO = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'] as const;

export function sectionNo(): () => string {
  let i = 0;
  return () => GROUP_NO[i++] ?? String(i);
}
