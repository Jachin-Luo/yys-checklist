import type { Item } from '../../api/types';
import { DEFAULT_CARD_DISPLAY } from '../../domain/cardDisplay';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useAutoDaily } from '../../hooks/useAutoDaily';
import { useCheckStore } from '../../stores/check';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';
import CheckBox from './CheckBox';
import { FieldIcon } from './ItemField';
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
      className={`no-press-select relative mx-3.5 mt-2.5 flex cursor-pointer items-start gap-x-2.5 rounded-sm border border-gold-line/40 bg-gradient-to-r from-gold-soft to-fill px-3.5 pb-4 pt-3 transition-all duration-300 ease-genso ${
        pressing ? 'scale-[0.985]' : ''
      }`}
    >
      {/* 长按进度：与 `ChecklistItem` 同一形态（常驻元素 + 条件宽度，
          动态挂载会让 width 过渡没有起点、一帧闪满），同样贴**底边** —— 按压反馈要在手指落点附近 */}
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 h-0.5 bg-crimson ${
          pressing ? 'w-full transition-[width] duration-500 ease-linear' : 'w-0 transition-none'
        }`}
      />

      <CheckBox
        checked={checked}
        onToggle={() => {
          if (swallowClick()) return;
          toggleHub();
        }}
        label={label}
      />

      <div className="min-w-0 flex-1">
        <h3
          className={`flex min-w-0 items-center gap-2.5 break-words font-serif text-base leading-snug tracking-card ${
            checked ? 'text-ink-3 line-through decoration-crimson decoration-1' : 'text-gold-hi'
          }`}
        >
          <Icon name="suzu" size={17} className="mt-0.5" />
          {item.name}
        </h3>

        {/* 这一行是"入口路径 + 覆盖计数"的混合内容：`path` 关闭时只隐藏路径部分，
            **覆盖计数始终显示** —— 它才是入口卡要传达的核心（点它会连带勾上多少项） */}
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
      </div>

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
        className="mt-0.5 flex-none cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-gold-hi transition-colors duration-120 hover:border-gold-hi hover:bg-surface"
      >
        去设置
      </button>
    </article>
  );
}
