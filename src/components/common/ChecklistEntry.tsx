import type { Item } from '../../api/types';
import { isGroup } from '../../domain/steps';
import ChecklistGroupCard from './ChecklistGroupCard';
import ChecklistItem from './ChecklistItem';

/**
 * 清单渲染单元的分发件：**单条 → 单条卡，有子步骤 → 多次卡**（2026-09-28）。
 *
 * ## 为什么要有这一层
 *
 * 页面拿到的是「已排序的条目数组」，而"这张卡走哪条渲染路径"要看它自己有没有
 * `children` —— 把判断收在这里，页面只管映射，不必关心卡的内部形状。
 *
 * ## 三个"由谁决定"的口径
 *
 * | 入参 | 单条卡 | 多次卡 |
 * |---|---|---|
 * | `dimmedOf`（被一键日常覆盖而弱化） | 该条自己 | **父条目**（整张卡一个状态） |
 * | `showDeadline`（是否显示截止徽章） | 该条自己 | 父条目的截止（子步骤不覆盖周期字段） |
 * | `highlightOf`（唯一高亮位） | 该条自己 | 父条目（整张卡一起高亮） |
 *
 * 2026-09-28：三处全部从"看组内成员"改成"看父条目" —— 粒度锁在父条目上，
 * 子步骤不单独进排序 / 隐藏 / 置顶 / 筛选，所以这里没有"一半亮一半蒙"的可能。
 */
export default function ChecklistEntry({
  item,
  dimmedOf,
  showDeadline = false,
  highlightOf,
  onToggle,
  cascadeIds,
}: {
  item: Item;
  /** 该条目是否应弱化（页面自己的 `isDimmed` 助手原样传进来） */
  dimmedOf?: (id: string) => boolean;
  /** `true` = 都显示；也可传判定函数（限时页只给真有截止的条目显示） */
  showDeadline?: boolean | ((item: Item) => boolean);
  /** 该条目是否占据本页的「唯一高亮位」 */
  highlightOf?: (id: string) => boolean;
  /** 覆盖默认勾选行为（一键日常入口卡走双向级联）—— 只有单条卡消费 */
  onToggle?: () => void;
  /** 长按跨账号时一并写入的额外条目 id —— 只有单条卡消费 */
  cascadeIds?: string[];
}) {
  if (isGroup(item)) {
    return (
      <ChecklistGroupCard
        item={item}
        dimmed={dimmedOf ? dimmedOf(item.id) : false}
        showDeadline={typeof showDeadline === 'function' ? showDeadline(item) : showDeadline}
        highlight={highlightOf ? highlightOf(item.id) : false}
      />
    );
  }

  return (
    <ChecklistItem
      item={item}
      dimmed={dimmedOf ? dimmedOf(item.id) : false}
      showDeadline={typeof showDeadline === 'function' ? showDeadline(item) : showDeadline}
      highlight={highlightOf ? highlightOf(item.id) : false}
      onToggle={onToggle}
      cascadeIds={cascadeIds}
    />
  );
}
