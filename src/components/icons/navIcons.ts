import type { NavKey } from '../../stores/ui';
import type { IconName } from './Icon';

/**
 * 导航项的图标分配 —— 两端共用同一份，避免"手机一个符号、PC 另一个"。
 *
 * 取的是**页面语义**而不是通用 UI 隐喻：
 *   今日 = 鸟居（日常委托）、本周 = 折扇（周常）、本月 = 历札、
 *   限时 = 提灯（活动）、统计 = 晴明纹、工具 = 金槌、设置 = 达摩。
 */
export const NAV_ICON: Record<NavKey, IconName> = {
  today: 'torii',
  week: 'ougi',
  month: 'koyomi',
  limited: 'chochin',
  stats: 'seimei',
  tools: 'kanazuchi',
  me: 'daruma',
};
