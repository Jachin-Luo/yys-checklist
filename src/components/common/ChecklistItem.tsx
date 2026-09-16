import { memo } from 'react';
import { Star } from 'lucide-react';
import type { Item } from '../../api/types';
import { DEFAULT_CARD_DISPLAY } from '../../domain/cardDisplay';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useCheckStore } from '../../stores/check';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
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
  /** 在**标题行内**显示截止徽章（限时页用）—— 不独占右侧列，避免压窄正文导致备注提前折行 */
  showDeadline?: boolean;
  dimmed?: boolean;
  /** 覆盖默认的勾选行为（一键日常入口需要走双向级联） */
  onToggle?: () => void;
  /**
   * 长按跨档案勾选时**一并写入**的额外条目 id。
   * 一键日常入口卡传它的覆盖项，使跨档案范围与当前档案的级联范围一致。
   */
  cascadeIds?: string[];
}

function ChecklistItem({
  item,
  showDeadline = false,
  dimmed = false,
  onToggle,
  cascadeIds,
}: Props) {
  const checked = useCheckStore((s) => s.checked[item.id] !== undefined);
  const toggle = useCheckStore((s) => s.toggle);
  const meta = useItemStore((s) => s.meta);
  const pinned = useViewStore((s) => s.view.pinned.includes(item.id));
  const togglePin = useViewStore((s) => s.togglePin);
  /* 卡片显示哪些字段（2026-09-16 用户需求，设置页「视图偏好」）。
     `?? DEFAULT` 只是类型兜底：store 里的 view 已过 `effectiveView`，实际总带 card
     （老数据也在那里被补成"全部显示"，所以这个功能的引入不改变任何人的现有观感）。 */
  const card = useViewStore((s) => s.view.card) ?? DEFAULT_CARD_DISPLAY;

  const askPick = useUiStore((s) => s.askPick);
  const toggleInProfiles = useCheckStore((s) => s.toggleInProfiles);

  const handleToggle = onToggle ?? (() => void toggle(item.id));

  /*
   * 长按 = 跨档案勾选（2026-09-16 用户需求）：弹出档案选择器，确认后这一组条目写进选中的其他档案。
   * 这里**没有** await 的 UI 阻塞：其他档案的写盘在后台进行，当前档案走既有的乐观更新，
   * 用户点完立刻能看到本档的状态变化。
   *
   * `cascadeIds` 由调用点给出：一键日常入口卡把自己的**覆盖项**传进来，
   * 于是跨档案写入与当前档案的级联范围一致 —— 否则目标档案会出现
   * "入口已完成、被覆盖项没勾"的不一致状态（统计口径上最难被发现的那类坏数据）。
   */
  const { handlers, pressing, swallowClick } = useLongPress({
    duration: LONG_PRESS_MS,
    onLongPress: () => {
      void (async () => {
        const picked = await askPick({ itemId: item.id, itemName: item.name, checked });
        if (!picked?.length) return;
        await toggleInProfiles([item.id, ...(cascadeIds ?? [])], picked);
      })();
    },
  });

  const kindLabels = dictIndexOf(meta, 'gainKind');
  const labelMap = new Map([...kindLabels.entries()].map(([k, v]) => [k, v.label]));

  const opacity = checked ? 'opacity-45' : dimmed ? 'opacity-60' : '';

  return (
    <article
      {...handlers}
      className={`relative flex min-w-0 items-start gap-2.5 overflow-hidden rounded-md border bg-surface px-3.5 py-3 transition-all duration-120 ${opacity} cursor-pointer ${
        pressing ? 'scale-[0.985] border-brand bg-brand-soft/40' : 'border-line-soft hover:border-line'
      }`}
      onClick={() => {
        /* 长按刚触发过：这次 click 是 Web 事件序列的副作用，吞掉它，
           否则用户"长按选档案"会顺手把当前档案也勾上 */
        if (swallowClick()) return;
        handleToggle();
      }}
    >
      {/* 长按进度（2026-09-16 用户要求"让用户知道正在被长按"）：
          常驻元素 + 条件宽度，而不是按住时才挂载 —— 动态挂载的 width 过渡没有起始值，
          浏览器不会插值，进度条会一帧闪满，看不到"正在按住"的过程。
          取消时用 `transition-none` 立即跳回，否则会看到它慢慢缩回去。 */}
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 h-0.5 bg-brand ${
          pressing ? 'w-full transition-[width] duration-500 ease-linear' : 'w-0 transition-none'
        }`}
      />
      <CheckBox
        checked={checked}
        onToggle={() => {
          if (swallowClick()) return;
          handleToggle();
        }}
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
          {/* 截止徽章放**标题行内**：原先它独占卡片右侧一列，那一列会把内容区压窄，
              使下方备注提前换行 —— 而限时页里备注最长的恰恰都是带 deadline 的条目
              （2026-09-14 用户反馈）。时间类徽章现在都集中在标题行：截止 → 覆盖 → 会员 → 时间窗 */}
          {card.tags && showDeadline ? <DeadlineTag item={item} /> : null}
          {card.tags && item.autoDaily ? <CoveredTag /> : null}
          {card.tags && item.premium ? <PremiumTag /> : null}
          {/* 关掉 `tags` 时 `TimeTag` 一并消失 —— 它在没有时间窗时会渲染 `timeNote`
             那句说明，同属"时间信息"，拆开反而会出现"关了一半"的怪异状态 */}
          {card.tags ? <TimeTag item={item} /> : null}
        </h3>

        {card.gain ? <GainBadges gain={item.gain} note={item.gainNote} /> : null}
        {card.kinds ? <KindBadges kinds={item.gainKind} gain={item.gain} labels={labelMap} /> : null}

        {/* 这三行是卡片高度的主要来源，也是「只想打卡」时最不需要的内容 —— 逐项可关 */}
        {card.path && item.path ? <Field kind="path" value={item.path} /> : null}
        {card.condition && item.condition ? <Field kind="condition" value={item.condition} /> : null}
        {card.note && item.note ? <Field kind="note" value={item.note} /> : null}
      </div>

      <button
        type="button"
        aria-label={pinned ? `取消置顶：${item.name}` : `置顶：${item.name}`}
        title={pinned ? '取消置顶' : '置顶这条'}
        /* 星标是独立控件：按下就阻止冒泡，否则在它身上按住会触发整卡的长按选择器 */
        onPointerDown={(e) => e.stopPropagation()}
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
