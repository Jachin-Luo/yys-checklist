import type { Item } from '../../api/types';
import type { ItemUnit } from '../../domain/grouping';
import ChecklistGroupCard from './ChecklistGroupCard';
import ChecklistItem from './ChecklistItem';

/**
 * 清单渲染单元的分发件：**单条 → 单条卡，同组 → 聚合卡**（2026-09-24，方案 B）。
 *
 * ## 为什么要有这一层
 *
 * 聚合是**渲染时**发生的（数据一行不改，见 `domain/grouping` 的文件头），
 * 而"哪些条目构成一组"必须在**整个列表**上判定 —— 单张卡自己看不到兄弟条目。
 * 于是页面把「已排序的条目数组」交给 `groupByCount` 折成渲染单元，再逐单元交给本组件；
 * 页面只需要改一行映射，不必关心单元是什么形状。
 *
 * ## 三个"由谁决定"的口径
 *
 * | 入参 | 单条卡 | 聚合卡 |
 * |---|---|---|
 * | `dimmedOf`（被一键日常覆盖而弱化） | 该条自己 | **全组都弱化**才算弱化 |
 * | `showDeadline`（是否显示截止徽章） | 原样 | 全组**任一**有截止就显示（取最早那个） |
 * | `highlightOf`（唯一高亮位） | 该条自己 | 组内**任一**命中即高亮（限时页给临期条目） |
 *
 * 聚合侧一律取"更保守"的方向：弱化要整组一致（否则一半蒙一半亮，读起来像 bug），
 * 截止与高亮取并集（宁可早提示、也不漏提示）。
 */
export default function ChecklistEntry({
  unit,
  dimmedOf,
  showDeadline = false,
  highlightOf,
  onToggle,
  cascadeIds,
}: {
  unit: ItemUnit;
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
  if (unit.grouped) {
    return (
      <ChecklistGroupCard
        unit={unit}
        dimmed={dimmedOf ? unit.items.every((it) => dimmedOf(it.id)) : false}
        showDeadline={
          typeof showDeadline === 'function'
            ? unit.items.some((it) => showDeadline(it))
            : showDeadline
        }
        highlight={highlightOf ? unit.items.some((it) => highlightOf(it.id)) : false}
      />
    );
  }

  const item = unit.items[0];
  return (
    <ChecklistItem
      item={item}
      dimmed={dimmedOf ? dimmedOf(item.id) : false}
      showDeadline={
        typeof showDeadline === 'function' ? showDeadline(item) : showDeadline
      }
      highlight={highlightOf ? highlightOf(item.id) : false}
      onToggle={onToggle}
      cascadeIds={cascadeIds}
    />
  );
}
