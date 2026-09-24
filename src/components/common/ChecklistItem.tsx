import { memo } from 'react';
import type { Item } from '../../api/types';
import { DEFAULT_CARD_DISPLAY } from '../../domain/cardDisplay';
import type { Cycle } from '../../domain/enums';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useCheckStore } from '../../stores/check';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';
import CheckBox from './CheckBox';
import { CoveredTag, GainBadges, KindBadges, PremiumTag } from './GainBadges';
import { Field } from './ItemField';
import { DeadlineTag, TimeTag } from './Tags';
import Icon, { type IconName } from '../icons/Icon';
import { SnakeEye } from '../ornament';

/**
 * 清单条目（共享原子件）—— **两端完全一致的一颗卡**：同样的外框、同样的内容、
 * 同样的大小。差异只剩「列数」，由页面容器 `CHECKLIST_GRID` 决定（手机 `grid-cols-1`、
 * PC `lg` 起双列）。这是设计文档 §8.3「共享原子件、只改排列方式」最彻底的形态。
 *
 * **点击整张卡即可勾选**（产品决策）；语义控件仍是左侧的菱形符格（可聚焦、可键盘操作），
 * 卡片的点击只是把命中区域放大到整行。置顶 ☆ 会 `stopPropagation`，避免点星号误勾。
 *
 * ## 2026-09-23 换肤：从"浅色卡片"改成"朱印委托札"
 *
 * 四条视觉通道，互不抢占（参考稿 §4.2）：
 *
 * | 通道 | 未完成 | 已完成 |
 * |---|---|---|
 * | 左侧 3px 竖条 + 上下菱形挂角 → 2026-09-24 起只留**圆头竖条** | `state-active` 靛蓝 | `crimson-soft` 暗朱 |
 * | 卡片底 | `surface`（纯白浮起） | `card-done`（主动沉下去） |
 * | 任务名 | 衬线 14.5px + 字距 .6px，`ink` | `ink-4` + 朱红划除线 |
 * | 底轨 2px | 空槽 | 朱红满格 |
 *
 * ## 2026-09-24 圆润版
 *
 *   - **竖条去掉上下菱形挂角**：菱形是方正语言的角饰，挂在 14px 圆角的卡片上会"穿帮"；
 *     改成整条圆头（`rounded-full`）+ 卡片 `overflow-hidden`，两端自然收进圆角里。
 *     **任务卡左侧的菱形符格（勾选控件）保留** —— 参考稿自己说了"点一次菱形推进一步"，
 *     菱形是任务卡的语言，圆润版只换了表单类控件（见 `ProfilePickDialog` 的圆角方块）。
 *   - 悬停从 `surface-3`（更暗）改成 `surface-hi`（更亮的暖白）：卡片已经是最亮的纯白，
 *     再往暗里压等于"悬停 = 沉下去"，与浮起方向反了。
 *   - 置顶星标改圆头，未置顶色从 `line`（本条线的色）改成 `ink-4`（装饰图标档）。
 *
 * **关于"序号"与"菱形进度格"**：参考稿的任务卡左侧有 01/02 序号、第二行有一排菱形进度格
 * （格数 = 目标次数）。
 *   - 序号 —— 仍然**不做**：清单顺序由用户拖拽 / 痛感分决定，序号是伪信息；
 *   - 进度格 —— **单条卡不做，聚合卡做**（2026-09-24 改口）。这条前提原本是
 *     "数据模型是布尔勾选，没有 `cur/total`"，但按次数聚合之后 `cur/total` 是**真的**
 *     （组内已完成条数 / 可见步数，见 `domain/grouping.unitProgress`），所以
 *     "第 k/N 次"那类条目的进度画得出来，也画在它的卡上（`ChecklistGroupCard` 的菱形进度格）。
 *     单条卡仍然没有次数可言 —— 它的"进度"就是"做没做"，左侧菱形符格本身就是那个答案，
 *     再排一排格子只会是"一格"或假进度。
 *
 * `dimmed` 表示「被一键日常覆盖且当前为弱化显示」。**完成态优先**：已完成项走完成样式，
 * 不再二次叠加弱化，避免低到看不清。
 *
 * `highlight` = 本页的「唯一高亮位」（金描边 + 淡金底）。全屏只允许一处：
 * 限时页给临期条目，其余页面给一键日常入口卡。已完成项不参与高亮 ——
 * 参考稿铁律二：已完成必须主动降饱和沉下去。
 *
 * ## 卡片内的信息层级（2026-09-11 四次调整后的最终口径）
 *
 * 1. **初版**：`reward` / `path` / `note` 三行全是 `text-ink-3` 且无标签 —— 看不出重点。
 * 2. **二版**：加中文标签、值分三档灰。但**标签压到 `text-ink-4` 是错的** —— 那个颜色当时
 *    只有 2.38:1，标签的存在意义就是让人知道这行是什么，压到不可读等于自毁。
 * 3. **三版**：中文标签改**图标**（见 `ItemField`），各类字段配专属颜色。
 * 4. **四版**：**删掉 `reward` 那一行**（字段已从数据模型删除，与 `gainKind` 徽章信息重叠）。
 *
 * 现在整张卡的读法是：**衬线大标题 → 金色任务类型符 → 彩色徽章 → 彩色图标 + 同色值**。
 * 全站统一：**`ink-4` 只用于占位符、装饰图标、禁用态**，不承载任何语义。
 */
interface Props {
  item: Item;
  /** 在**标题行内**显示截止徽章（限时页用）—— 不独占右侧列，避免压窄正文导致备注提前折行 */
  showDeadline?: boolean;
  dimmed?: boolean;
  /** 本页的「唯一高亮位」（金描边 + 淡金底）。全屏最多一处，已完成项自动失效 */
  highlight?: boolean;
  /** 覆盖默认的勾选行为（一键日常入口需要走双向级联） */
  onToggle?: () => void;
  /**
   * 长按跨账号勾选时**一并写入**的额外条目 id。
   * 一键日常入口卡传它的覆盖项，使跨账号范围与当前账号的级联范围一致。
   */
  cascadeIds?: string[];
}

/**
 * 任务类型符号 = 条目的**周期**（不是奖励类型）。
 * 为什么不用 `path` / `gainKind` 猜：`path` 是自由文本，用正则从文本反推类型是
 * 历史反面教材（AGENTS 铁律 7）。`cycle` 是结构化枚举，映射是确定的。
 */
const CYCLE_ICON: Record<Cycle, IconName> = {
  once: 'ofuda',
  daily: 'ema',
  weekly: 'ougi',
  monthly: 'koyomi',
  limited: 'chochin',
  version: 'nobori',
  season: 'nobori',
};

function ChecklistItem({
  item,
  showDeadline = false,
  dimmed = false,
  highlight = false,
  onToggle,
  cascadeIds,
}: Props) {
  const checked = useCheckStore((s) => s.checked[item.id] !== undefined);
  const toggle = useCheckStore((s) => s.toggle);
  const meta = useItemStore((s) => s.meta);
  const pinned = useViewStore((s) => s.view.pinned.includes(item.id));
  const togglePin = useViewStore((s) => s.togglePin);
  /* 卡片显示哪些字段（2026-09-16 用户需求，设置页「视图偏好」）。
     `?? DEFAULT` 只是类型兜底：store 里的 view 已过 `effectiveView`，实际总带 card。 */
  const card = useViewStore((s) => s.view.card) ?? DEFAULT_CARD_DISPLAY;

  const askPick = useUiStore((s) => s.askPick);
  const toggleInProfiles = useCheckStore((s) => s.toggleInProfiles);

  const handleToggle = onToggle ?? (() => void toggle(item.id));

  /*
   * 长按 = 跨账号勾选（2026-09-16 用户需求）：弹出账号选择器，确认后这一组条目写进选中的其他账号。
   * 这里**没有** await 的 UI 阻塞：其他账号的写盘在后台进行，当前账号走既有的乐观更新。
   *
   * `cascadeIds` 由调用点给出：一键日常入口卡把自己的**覆盖项**传进来，
   * 于是跨账号写入与当前账号的级联范围一致 —— 否则目标账号会出现
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

  /* 2026-09-24 去掉"已完成整卡 opacity-60"：那是三级衰减相乘里的第二级，
     叠上卡底色与文字色之后，已完成项文字实测只有 **1.68:1**（暗版 1.83）——
     已接近"消失"，与既定口径「不消失、沉下去」相悖。沉下去由卡底色（`card-done`）
     + 朱红划线 + 菱形符三个通道承担，不需要再整卡调透明度。 */
  const opacity = dimmed ? 'opacity-70' : '';
  /* 收益徽章的站位随断点（册页稿同一张 `.entry` 的两副面孔）：
     桌面 = 右侧独立一列（`.pay`，所有行的收益徽章右对齐成一条竖线，一眼能扫总额）；
     移动 = 留在正文流（标题下方换行 —— 窄屏再拆一列会把说明压得过早折行）。
     断点判据与 `PageHead` 同源（`useBreakpoint`，全站唯一分流判据） */
  const payColumn = useBreakpoint() === 'desktop';
  /* 高亮位只允许给"还没了结"的条目：已完成必须沉下去（参考稿铁律二） */
  const isHighlight = highlight && !checked;

  return (
    <article
      {...handlers}
      data-state={checked ? 'done' : 'open'}
      className={[
        /* 账目行（册页稿 `.entry`）：不再是卡 —— 行直接铺在册页上，行间分隔线由
           `CHECKLIST_GRID` 容器给（每行 `border-t`、首行豁免），hover 铺填充底 */
        'group no-press-select relative flex cursor-pointer items-start gap-2.5 rounded-sm border-t border-line-soft px-3 py-2.5 transition-colors duration-150 ease-genso first:border-t-0',
        checked ? 'bg-card-done' : 'hover:bg-fill',
        isHighlight ? 'bg-gold-soft ring-1 ring-gold-line' : '',
        pressing ? 'scale-[0.985]' : '',
        opacity,
      ].join(' ')}
      onClick={() => {
        /* 长按刚触发过：这次 click 是 Web 事件序列的副作用，吞掉它，
           否则用户"长按选账号"会顺手把当前账号也勾上 */
        if (swallowClick()) return;
        handleToggle();
      }}
    >
      {/* 左缘竖线：**常驻**（2026-09-24 用户要求：原本只在长按/已完成时出现，"直接改成常驻"）。
          参考稿 `.entry::before` 是 hover 0.30 / data-on 1 的状态线；按用户口径升级为
          每行的固定结构线 —— 未完成 = 淡墨（`line`），悬停加深为朱红预告（参考稿的 hover 态）；
          已完成 = 朱红。朱红仍只给"了结"的行，否则整列常红就成了警戒线 */}
      <span
        aria-hidden
        className={`absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full transition-colors duration-150 ${
          checked ? 'bg-crimson' : 'bg-line group-hover:bg-crimson/40'
        }`}
      />

      {/* 长按进度贴**底边**、与 2px 底轨共用同一条边：两者都是 2px，叠在一起不会互相误读，
          而它渲染在底轨之后 → 压在上面。2026-09-23 修：上一版把它挪到了卡片顶部，
          用户反馈"长按的条怎么跑到上面了" —— 按压反馈跑离手指落点就是错的 */}
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
          handleToggle();
        }}
        label={`${checked ? '取消完成' : '标记完成'}：${item.name}`}
      />

      {/* 周期符独占一列（参考稿 `.entry .glyph` 的站位）：标题与其下所有行都从 body
          左缘起 —— 之前它挤在标题行里，标题被顶右、下面的行缩回去，正是"没对齐"的来源 */}
      <Icon
        name={CYCLE_ICON[item.cycle]}
        size={17}
        /* 已完成侧 `text-ink-3` / 未完成侧 `text-gold-hi` —— 调色口径见文件头换肤一节 */
        className={`mt-0.5 flex-none ${checked ? 'text-ink-3' : 'text-gold-hi'}`}
      />

      <div className="min-w-0 flex-1">
        {/* `break-words` 给超长不可断串兜底：名称里塞英文串 / UID 时，双列每列只有 ~390px */}
        <h3
            className={`flex min-w-0 flex-wrap items-center gap-1.5 break-words text-base font-semibold leading-snug tracking-card ${
              /* 已完成**任务名**同样提到 `ink-3`：它才是读者最需要看清的那行字，
                 裸 `ink-4` 在卡片上只有 3.56（暗版 3.14）。划线 + 卡底色已足够表达"已完成" */
              checked ? 'text-ink-3 line-through decoration-crimson decoration-1' : 'text-ink'
            }`}
          >
            {item.name}
            {/* 蛇目纹紧贴任务名右侧 10px，不占独立站位 */}
            {checked ? <SnakeEye size={13} className="ml-1" /> : null}
            {/* 截止徽章放**标题行内**：原先它独占卡片右侧一列，那一列会把内容区压窄，
                使下方备注提前换行 —— 而限时页里备注最长的恰恰都是带 deadline 的条目。
                时间类徽章现在都集中在标题行：截止 → 覆盖 → 会员 → 时间窗 */}
            {card.tags && showDeadline ? <DeadlineTag item={item} /> : null}
            {card.tags && item.autoDaily ? <CoveredTag /> : null}
            {card.tags && item.premium ? <PremiumTag /> : null}
            {/* 关掉 `tags` 时 `TimeTag` 一并消失 —— 它在没有时间窗时会渲染 `timeNote`
                那句说明，同属"时间信息"，拆开反而会出现"关了一半"的怪异状态 */}
            {card.tags ? <TimeTag item={item} /> : null}
        </h3>

        {/* 收益徽章：移动端留在正文流；桌面端挪到下面的右列（`.pay`） */}
        {!payColumn ? (
          <>
            {card.gain ? <GainBadges gain={item.gain} note={item.gainNote} /> : null}
            {card.kinds ? (
              <KindBadges kinds={item.gainKind} gain={item.gain} labels={labelMap} />
            ) : null}
          </>
        ) : null}

        {/* 这三行是卡片高度的主要来源，也是「只想打卡」时最不需要的内容 —— 逐项可关 */}
        {card.path && item.path ? <Field kind="path" value={item.path} /> : null}
        {card.condition && item.condition ? <Field kind="condition" value={item.condition} /> : null}
        {card.note && item.note ? <Field kind="note" value={item.note} /> : null}
      </div>

      {/* 桌面右列（册页稿 `.entry .pay`）：标签在上、徽章右对齐 ——
          不占正文宽度，说明文字不再因为徽章换行而提前折行 */}
      {payColumn ? (
        <div className="flex-none">
          {card.gain ? <GainBadges gain={item.gain} note={item.gainNote} column /> : null}
          {card.kinds ? (
            <KindBadges kinds={item.gainKind} gain={item.gain} labels={labelMap} column />
          ) : null}
        </div>
      ) : null}

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
        className={`mt-0.5 flex-none cursor-pointer rounded-full p-1 transition-colors duration-150 ease-genso hover:bg-fill ${
          pinned ? 'text-gold-hi' : 'text-ink-4 hover:text-gold-hi'
        }`}
      >
        <Icon name="pin" size={13} className={pinned ? '' : 'opacity-60'} />
      </button>
    </article>
  );
}

export default memo(ChecklistItem);
