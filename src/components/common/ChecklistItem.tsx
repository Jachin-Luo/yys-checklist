import { memo } from 'react';
import { Star } from 'lucide-react';
import type { Item } from '../../api/types';
import { useCheckStore } from '../../stores/check';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useViewStore } from '../../stores/view';
import CheckBox from './CheckBox';
import { CoveredTag, GainBadges, KindBadges, PremiumTag } from './GainBadges';
import { Field } from './ItemField';
import { DeadlineTag, TimeTag } from './Tags';

/**
 * 清单条目（共享原子件）—— **两端完全一致的一颗卡**：同样的外框、同样的内容、
 * 同样的大小。差异只剩「列数」，由页面容器 `CHECKLIST_GRID` 决定（手机 `grid-cols-1`、
 * PC `lg` 起双列）。这是设计文档 §8.3「共享原子件、只改排列方式」最彻底的形态。
 *
 * **点击整张卡即可勾选**（产品决策）；语义控件仍是左侧圆形勾选框（可聚焦、可键盘操作），
 * 卡片的点击只是把命中区域放大到整行。置顶 ☆ 会 `stopPropagation`，避免点星号误勾。
 *
 * **已移除原型 v8 的 S/A/B/C 价值徽章**（字段已删）：奖励信息由 `gain` + `gainKind` 徽章承担。
 *
 * `dimmed` 表示「被一键日常覆盖且当前为弱化显示」。**完成态优先**：
 * 已完成项走完成样式（划线 + 降透明度），不再二次叠加弱化，避免低到看不清。
 *
 * ## 卡片内的信息层级（2026-09-11 四次调整后的最终口径）
 *
 * 演进过程留在这里，因为每一步都是被具体问题推着走的：
 *
 * 1. **初版**：`reward` / `path` / `note` 三行全是 `text-ink-3` 且无标签 ——
 *    颜色一样、又不知道哪行是什么（用户反馈"多行内容一个颜色，看不出重点"）。
 * 2. **二版**：加中文标签、值分三档灰。但**标签压到 `text-ink-4` 是错的** ——
 *    那个颜色当时只有 2.38:1，标签的存在意义就是让人知道这行是什么，压到不可读等于自毁。
 * 3. **三版**：中文标签改**图标**（见 `ItemField`），各类字段配专属颜色 ——
 *    两个汉字占的横向空间还给正文，识别也更依赖图形。
 * 4. **四版（本版）**：**删掉 `reward` 那一行**。它渲染的是自由文本奖励描述，与 `gainKind`
 *    徽章信息重叠（`meta.gainKindNote` 自己写明 gainKind 是"人工读 reward 文本核定"的，
 *    两者是同一事实的两份编码；实测 89 条里 28% 完全重合）。字段本身也已从数据模型删除。
 *    同时 `compact` 开关一并去掉 —— 它唯一的用途就是"手机端省略 reward 行"，现在无事可做。
 *
 * 现在整张卡的读法是：**深色大标题 → 彩色徽章（有没有保底数值 / 含哪些类型）→ 彩色图标 + 同色值**。
 * 全站统一：**`ink-4` 只用于占位符、装饰图标、禁用态**，不承载任何语义。
 */
interface Props {
  item: Item;
  showDeadline?: boolean;
  dimmed?: boolean;
  /** 覆盖默认的勾选行为（一键日常入口需要走双向级联） */
  onToggle?: () => void;
}

function ChecklistItem({ item, showDeadline = false, dimmed = false, onToggle }: Props) {
  const checked = useCheckStore((s) => s.checked[item.id] !== undefined);
  const toggle = useCheckStore((s) => s.toggle);
  const meta = useItemStore((s) => s.meta);
  const pinned = useViewStore((s) => s.view.pinned.includes(item.id));
  const togglePin = useViewStore((s) => s.togglePin);

  const handleToggle = onToggle ?? (() => void toggle(item.id));

  const kindLabels = dictIndexOf(meta, 'gainKind');
  const labelMap = new Map([...kindLabels.entries()].map(([k, v]) => [k, v.label]));

  const opacity = checked ? 'opacity-45' : dimmed ? 'opacity-60' : '';

  return (
    <article
      className={`flex min-w-0 items-start gap-2.5 rounded-md border border-line-soft bg-surface px-3.5 py-3 transition-colors duration-120 hover:border-line ${opacity} cursor-pointer`}
      onClick={handleToggle}
    >
      <CheckBox
        checked={checked}
        onToggle={handleToggle}
        label={`${checked ? '取消完成' : '标记完成'}：${item.name}`}
      />

      <div className="min-w-0 flex-1">
        {/* `break-words` 给超长不可断串兜底：名称里塞英文串 / UID 时，双列每列只有 ~390px */}
        <h3
          className={`flex flex-wrap items-center gap-1.5 break-words text-lg font-medium leading-snug text-ink ${
            checked ? 'line-through' : ''
          }`}
        >
          {item.name}
          {item.autoDaily ? <CoveredTag /> : null}
          {item.premium ? <PremiumTag /> : null}
          <TimeTag item={item} />
        </h3>

        <GainBadges gain={item.gain} note={item.gainNote} />
        <KindBadges kinds={item.gainKind} gain={item.gain} labels={labelMap} />

        {item.path ? <Field kind="path" value={item.path} /> : null}
        {item.condition ? <Field kind="condition" value={item.condition} /> : null}
        {item.note ? <Field kind="note" value={item.note} /> : null}
      </div>

      {showDeadline ? <DeadlineTag item={item} /> : null}

      <button
        type="button"
        aria-label={pinned ? `取消置顶：${item.name}` : `置顶：${item.name}`}
        title={pinned ? '取消置顶' : '置顶这条'}
        onClick={(e) => {
          e.stopPropagation();
          void togglePin(item.id);
        }}
        className={`mt-0.5 flex-none cursor-pointer rounded-sm p-0.5 transition-colors duration-120 ${
          pinned ? 'text-warn-gold' : 'text-line hover:text-ink-4'
        }`}
      >
        <Star size={14} strokeWidth={2} fill={pinned ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

export default memo(ChecklistItem);
