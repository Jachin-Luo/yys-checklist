import type { Item } from '../../api/types';
import { DEFAULT_CARD_DISPLAY } from '../../domain/cardDisplay';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useAutoDaily } from '../../hooks/useAutoDaily';
import { useCheckStore } from '../../stores/check';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';
import CheckBox from './CheckBox';
import { FieldBlock, FieldIcon } from './ItemField';
import Icon from '../icons/Icon';

/**
 * 一键日常入口卡 —— 恒排第 0 位（**仅在未完成时**出现；完成后由今日页放进「已完成」分区）。
 *
 * 排序侧由 `domain/sort.ts` 的**前置特判**保证（不参与痛感分比较，D1）；
 * 勾选侧是**双向级联**：勾选即勾选全部被覆盖项，取消即一并取消（`useAutoDaily.toggleHub`）。
 * 点击整张卡即勾选。
 *
 * 右侧按钮**不再重复勾选动作**（2026-09-15 用户要求）：原文案「去完成」与"点整张卡"
 * 效果完全一样，等于白占一个按钮位 —— 而这一屏真正缺的入口是"改覆盖集合"。
 * 现在文案为「去设置」，点击跳到「设置 · 一键日常覆盖」并自动展开该分区。
 *
 * 2026-09-11：说明行改用与清单卡片**同一套图标语言**（`ItemField`）。
 * 2026-09-16：补上**长按跨账号勾选**（与清单卡片统一），并且带级联。
 * 2026-09-20：**跟随「视图偏好」**。本卡只有 `path` 与 `note` 两个块可关，
 *   且 **`path` 关掉后仍保留「已配置覆盖 N 项」** —— 那是入口卡的核心信息。
 *
 * ## 2026-09-23 换肤：它升格为本页的「唯一高亮位」
 *
 * 参考稿铁律二：**全屏只有一处**允许"高饱和色 + 金描边 + 淡色底"。
 * 上一版这张卡是品牌紫底 —— 换肤后紫已退场，而"这一屏最该先动手的一件事"这个语义
 * 恰恰需要高亮，于是它接管了参考稿里「可提交」态的那套视觉（金描边 + 淡金叠层 + 金晕）。
 * 图标也从内联闪电换成和风金槌（"一键"= 一锤定音）。
 */
export default function HubCard({ item }: { item: Item }) {
  const checked = useCheckStore((s) => s.checked[item.id] !== undefined);
  const toggleInProfiles = useCheckStore((s) => s.toggleInProfiles);
  const card = useViewStore((s) => s.view.card) ?? DEFAULT_CARD_DISPLAY;
  const { toggleHub, coveredCount, coveredIds } = useAutoDaily();
  const requestNav = useUiStore((s) => s.requestNav);
  const askPick = useUiStore((s) => s.askPick);
  const label = `${checked ? '取消完成' : '标记完成'}：${item.name}（同时${checked ? '取消' : '勾选'}被覆盖的 ${coveredCount} 项）`;

  /* 长按 = 跨账号勾选。与当前账号的 `toggleHub` 一样带**级联**：`coveredIds` 一并写过去，
     否则目标账号会出现"入口已完成、被覆盖项没勾"的不一致状态。 */
  const { handlers, pressing, swallowClick } = useLongPress({
    duration: LONG_PRESS_MS,
    onLongPress: () => {
      void (async () => {
        const picked = await askPick({ itemId: item.id, itemName: item.name, checked });
        if (!picked?.length) return;
        await toggleInProfiles([item.id, ...coveredIds], picked);
      })();
    },
  });

  return (
    /* `mx-3.5` + 内部 `px-3.5`：与清单卡片的左边界严格对齐（清单容器 px-3.5 + 卡片 px-3.5） */
    <article
      {...handlers}
      onClick={() => {
        /* 长按刚触发过：这次 click 是 Web 事件序列的副作用，吞掉它 */
        if (swallowClick()) return;
        toggleHub();
      }}
      className={`group no-press-select relative mx-3.5 mt-2.5 flex cursor-pointer items-start gap-x-1.5 rounded-sm border border-gold-line/40 bg-gradient-to-r from-gold-soft to-fill px-3.5 pb-4 pt-3 transition-all duration-300 ease-genso ${
        pressing ? 'scale-[0.985]' : ''
      }`}
    >
      {/* 左缘竖线：**常驻**，与账目行同一口径（2026-09-28）—— 入口卡也是清单里的一行，
          没有它时它在这列里是唯一"缺一道边"的（未完成=淡墨、悬停预告=朱红、已完成=朱红） */}
      <span
        aria-hidden
        className={`absolute bottom-3 left-0 top-3 w-0.5 rounded-r-full transition-colors duration-150 ${
          checked ? 'bg-crimson' : 'bg-line group-hover:bg-crimson/40'
        }`}
      />
      {/* 长按进度：与 `ChecklistItem` 同一形态（常驻元素 + 条件宽度，
          动态挂载会让 width 过渡没有起点、一帧闪满），同样贴**底边** —— 按压反馈要在手指落点附近。
          两端内缩的圆角轨道同理：这张卡也是圆角，整宽方头条会伸出圆角之外 */}
      <span
        aria-hidden
        className="absolute bottom-0 left-2.5 right-2.5 h-0.5 overflow-hidden rounded-full"
      >
        <i
          className={`block h-full rounded-full bg-crimson ${
            pressing ? 'w-full transition-[width] duration-500 ease-linear' : 'w-0 transition-none'
          }`}
        />
      </span>

      {/* 第一排对齐基准：**20px 框内居中**（与两张清单卡同一口径，见 `ChecklistItem` 菱形那处） */}
      <span className="flex h-5 flex-none items-center">
        <CheckBox
          checked={checked}
          onToggle={() => {
            if (swallowClick()) return;
            toggleHub();
          }}
          label={label}
        />
      </span>

      {/* 周期符独占一列（与 `ChecklistItem` / `ChecklistGroupCard` 同站位）——
          **这是"错行"的根因**：此前它塞在 h3 里，标题被图标顶右，而下面的「路径 + 覆盖计数」
          与「备注」从 body 左缘起，两行比标题靠左半个图标宽。图标挪出来后三行同左缘。
          配色也随之显式给出（原先是继承 h3 的文字色） */}
      <span className="flex h-5 flex-none items-center">
        <Icon
          name="suzu"
          size={17}
          className={`flex-none ${checked ? 'text-ink-3' : 'text-gold-hi'}`}
        />
      </span>

      <div className="min-w-0 flex-1">
        <h3
          className={`flex min-h-5 min-w-0 items-center gap-2.5 break-words font-serif text-base leading-5 tracking-card ${
            checked ? 'text-ink-3 line-through decoration-crimson decoration-1' : 'text-gold-hi'
          }`}
        >
          {item.name}
        </h3>

        {/* 标题之下的两行共用一个 `FieldBlock`（缩进引线）—— 与账目行的「路径 / 条件 / 备注」
            同一处理：这两行是标题的补充，缩进后不会与下一张卡串行。
            第一行是"入口路径 + 覆盖计数"的混合内容：`path` 关闭时只隐藏路径部分，
            **覆盖计数始终显示** —— 它才是入口卡要传达的核心（点它会连带勾上多少项） */}
        <FieldBlock>
          <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
            {card.path && item.path ? <FieldIcon kind="path" /> : null}
            <span className="min-w-0 flex-1 break-words text-ink-2">
              {card.path && item.path ? <span className="text-ticket">{item.path}</span> : null}
              {card.path && item.path ? ' · ' : ''}
              已配置覆盖 <b className="font-mono font-medium text-gold-hi">{coveredCount}</b> 项
            </span>
          </p>

          {card.note && item.note ? (
            <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
              <FieldIcon kind="note" />
              <span className="min-w-0 flex-1 break-words text-ink-2">{item.note}</span>
            </p>
          ) : null}
        </FieldBlock>
      </div>

      {/* 「去设置」也在第一排（右侧）：它与标题行同一基准 —— 20px 框内居中。
          这颗按钮本身比 20px 高（28px），所以**居中而不是缩高**：去掉原来的 `mt-0.5` 手调，
          上下各溢出 4px 正是等分的结果，中线才与标题、菱形、周期符落在同一条上 */}
      <span className="flex h-5 flex-none items-center">
        <button
          type="button"
          /* 与 `ChecklistItem` 的星标同理：独立控件按下就阻止冒泡，避免在它身上按住触发整卡的长按 */
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            /* 按钮在可点击的 article 内部：必须阻止冒泡，否则会连带触发整卡的勾选 */
            e.stopPropagation();
            requestNav({ nav: 'me', section: 'autoDaily' });
          }}
          title="去「设置」配置被一键日常覆盖的条目"
          className="flex-none cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-gold-hi transition-colors duration-120 hover:border-gold-hi hover:bg-surface"
        >
          去设置
        </button>
      </span>
    </article>
  );
}
