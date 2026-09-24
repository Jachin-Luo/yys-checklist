import type { NavKey } from '../../stores/ui';
import type { IconName } from './Icon';

/**
 * 导航项的图标分配 —— 两端共用同一份，避免"手机一个符号、PC 另一个"。
 *
 * 取的是**页面语义**而不是通用 UI 隐喻：
 *   今日 = 绘马（一日一愿）、本周 = 折扇（扇骨七日一折）、本月 = 历札、
 *   限时 = 提灯（挂起即开场）、统计 = 柱状、工具 = 金槌、设置 = 双滑杆。
 *
 * 2026-09-24 按 `uiRef/囤囤鼠大作战_和风图标集.html` 修掉两处**借图**：
 *   统计原借「晴明纹」（那正是品牌徽记本身，一张图不能既当 logo 又当功能图标）、
 *   设置原借「达摩」（达摩是"愿 / 缘"，与设置无关）。
 * 同时「今日」由鸟居改为绘马 —— 鸟居原本一图担四义（今日页 / 每日条目 / 入口字段 / 空态），
 * 收敛后只表"入口"，今日页交给绘马。
 */
export const NAV_ICON: Record<NavKey, IconName> = {
  today: 'ema',
  week: 'ougi',
  month: 'koyomi',
  limited: 'chochin',
  stats: 'chart',
  tools: 'kanazuchi',
  me: 'setting',
};
