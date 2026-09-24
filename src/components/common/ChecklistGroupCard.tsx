import { memo } from 'react';
import type { Item } from '../../api/types';
import { DEFAULT_CARD_DISPLAY } from '../../domain/cardDisplay';
import type { ItemUnit } from '../../domain/grouping';
import { unitProgress } from '../../domain/grouping';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useCheckStore } from '../../stores/check';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';
import { CoveredTag, GainBadges, KindBadges, PremiumTag } from './GainBadges';
import { Field } from './ItemField';
import { DeadlineTag, TimeTag } from './Tags';
import Icon, { type IconName } from '../icons/Icon';
import { SnakeEye } from '../ornament';

/**
 * **聚合卡**：把「同一件事的第 k / N 次」并成一张卡，菱形当推进器（2026-09-24 用户需求，方案 B）。
 *
 * 数据一行都没改 —— 组与组内成员由 `domain/grouping.groupByCount` 从既有名字里推导，
 * **进度 = 组内真实已完成的条数**（`unitProgress`），不是另记一个计数。
 *
 * ## 与 `ChecklistItem`（单条卡）的关系
 *
 * 外壳、颜色、动效全部同构（同一套令牌类），差异只在**三个地方**：
 *
 * | | 单条卡 | 聚合卡 |
 * |---|---|---|
 * | 左侧菱形 | 勾选框：点一下 = 完成 / 取消 | **推进器**：点一下 = 完成下一步；满段后再点 = 取消整组 |
 * | 标题行 | 任务名 | 组名 + **菱形进度格**（一格一步）+ **`cur/total` 等宽计数** |
 * | 逐次说明 | 恒显示本条自己的 | 显示**当前这一步**的（`地域鬼王 2/3` 的"需声望 2000" 只在推进到那一步时出现） |
 *
 * 外壳代码与 `ChecklistItem` 是重复的（两份 `article` + 竖条 + 底轨）。**暂时不抽公共壳**：
 * 抽壳要引入一层 slot 协议，而现在只有两张卡；等第三张出现再抽，比先抽错便宜。
 *
 * ## 三个交互决策（我按最不意外的选项定的，可改）
 *
 * 1. **点整卡 = 点菱形 = 推进一步**（不另设"一键完成整组"）：与参考稿"点一次菱形推进一步"
 *    一致；否则整卡一点就满段，"分段推进"就没有意义了。
 * 2. **满段后再点 = 取消整组**（把整组成员一起清掉），与单条卡"再点一次取消"同源。
 * 3. **长按 = 把当前进度复刻到其他账号**：把「下一步 + 已完成的那些步」一起写过去，
 *    `toggleInProfiles` 的方向由**第一个 id** 决定，所以第一个必须放"下一步"（它必然是
 *    未完成 → 整批按"勾选"写），目标账号拿到的正好是"前 cur+1 步已完成"。
 *    满段时长按传整组（第一个已完成 → 整批按"取消"写），语义是撤销。
 *
 * ## 菱形进度格（2026-09-24 用户要求："没有菱形的进度"）
 *
 * 单条卡当初否掉了参考稿的"一排菱形进度格"，理由是"数据是布尔勾选、没有 `cur/total`" ——
 * 这条前提**在聚合卡上不成立**：`cur/total` 是组内真实的已完成条数。所以进度格只画在这里：
 * 一格 = 一步，三态与推进器同一套（金描边空心 → 朱红描边 = 当前步 → 朱红实心 = 已完成），
 * "走到第几步"是**看得见的一排**，不必只靠数字。格数 = `unit.total` = **可见步数**
 * （某一步被手动隐藏时按剩余步数算，见 `domain/grouping` 的缺员说明）。
 * 它纯装饰（`aria-hidden`）：读屏器由紧随其后的 `cur/total` 承担。
 *
 * ## 徽章与字段的"宁可少显示"原则
 *
 * 逐次不同的信息（时间窗、奖励、入口）**只在全组一致时显示**，否则整项不显示 ——
 * 把 `1/3` 的时间当成 `2/3` 的显示，比不显示更糟。唯一的例外是**截止**：取全组**最早**
 * 的那个（临期提示宁可早不可晚）。逐次说明（`note` / `condition`）不受此限，
 * 它显示的就是**当前这一步**的原文，天然准确。
 */
function ChecklistGroupCard({
  unit,
  dimmed = false,
  showDeadline = false,
  highlight = false,
}: {
  unit: ItemUnit;
  dimmed?: boolean;
  showDeadline?: boolean;
  /** 「唯一高亮位」（金描边 + 淡金底）。与单条卡同一语义，全屏最多一处 */
  highlight?: boolean;
}) {
  const checked = useCheckStore((s) => s.checked);
  const toggle = useCheckStore((s) => s.toggle);
  const setMany = useCheckStore((s) => s.setMany);
  const toggleInProfiles = useCheckStore((s) => s.toggleInProfiles);
  const meta = useItemStore((s) => s.meta);
  const card = useViewStore((s) => s.view.card) ?? DEFAULT_CARD_DISPLAY;
  const askPick = useUiStore((s) => s.askPick);

  const isDone = (id: string) => checked[id] !== undefined;
  const cur = unitProgress(unit, isDone);
  const done = cur === unit.total;
  /* 当前步：未满段时是"下一步"，满段后退回最后一步（卡上仍能读到那一步的说明，不会突然空掉） */
  const step = unit.items[Math.min(cur, unit.total - 1)];

  /* 全组一致才显示（见文件头"宁可少显示"） */
  const sameOf = (pick: (it: Item) => string | undefined): string | undefined => {
    const first = pick(unit.items[0]);
    return unit.items.every((it) => pick(it) === first) ? first : undefined;
  };
  const samePath = sameOf((it) => it.path);
  const sameTime = sameOf((it) => it.time);
  const gain = unit.items.every((it) => JSON.stringify(it.gain) === JSON.stringify(unit.items[0].gain))
    ? unit.items[0].gain
    : undefined;
  const kinds = unit.items.every(
    (it) => JSON.stringify(it.gainKind) === JSON.stringify(unit.items[0].gainKind),
  )
    ? unit.items[0].gainKind
    : undefined;
  const kindLabels = new Map([...dictIndexOf(meta, 'gainKind').entries()].map(([k, v]) => [k, v.label]));
  /* 截止取最早那条 —— 与单条卡的 `showDeadline` 语义一致（限时页才传 true） */
  const earliest = unit.items.reduce<Item | null>(
    (acc, it) =>
      it.deadline && (!acc?.deadline || it.deadline < acc.deadline) ? it : acc,
    null,
  );

  /* 推进一步：勾掉下一个未完成的成员 */
  const advance = () => void toggle(unit.items[cur].id);
  /* 满段后再点：整组一起取消（`setMany` 传 null 即清掉这些 id） */
  const reset = () => void setMany(unit.items.map((it) => it.id), null);
  const onMain = () => (done ? reset() : advance());

  const { handlers, pressing, swallowClick } = useLongPress({
    duration: LONG_PRESS_MS,
    onLongPress: () => {
      void (async () => {
        const picked = await askPick({
          itemId: step.id,
          itemName: unit.label,
          checked: done,
        });
        if (!picked?.length) return;
        const payload = done
          ? unit.items.map((it) => it.id)
          : [step.id, ...unit.items.slice(0, cur).map((it) => it.id)];
        await toggleInProfiles(payload, picked);
      })();
    },
  });

  /* 与 `ChecklistItem` 同口径（2026-09-24）：去掉"已完成整卡 opacity-60" ——
     卡底色 + 朱红划线 + 菱心三态已经足够表达"沉下去但仍在" */
  const opacity = dimmed ? 'opacity-70' : '';
  const isHighlight = highlight && !done;
  /* 收益徽章的站位随断点 —— 与 `ChecklistItem` 同一条注释，不再重复 */
  const payColumn = useBreakpoint() === 'desktop';

  /* 三态菱形推进器：未开始 = 金描边空心 / 进行中 = 朱红描边 + 内芯 / 满段 = 朱红实心 */
  const mark =
    cur === 0
      ? 'border-gold bg-transparent'
      : done
        ? 'border-crimson bg-crimson'
        : 'border-crimson bg-transparent';

  return (
    <article
      {...handlers}
      data-state={done ? 'done' : 'open'}
      data-cur={cur}
      data-total={unit.total}
      className={[
        /* 账目行（册页稿 `.entry`）：与单条行同构；进度不再画底轨 —— 标题行里的
           菱形进度格 + `cur/total` 已经把"走到第几步"说清了 */
        'group no-press-select relative flex cursor-pointer items-start gap-2.5 rounded-sm border-t border-line-soft px-3 py-2.5 transition-colors duration-150 ease-genso first:border-t-0',
        done ? 'bg-card-done' : 'hover:bg-fill',
        isHighlight ? 'bg-gold-soft ring-1 ring-gold-line' : '',
        pressing ? 'scale-[0.985]' : '',
        opacity,
      ].join(' ')}
      onClick={() => {
        if (swallowClick()) return;
        onMain();
      }}
    >
      {/* 左缘竖线：**常驻** —— 与单条卡同口径（2026-09-24 用户要求）。满段 = 朱红，
          未满段 = 淡墨、悬停加深为朱红预告 */}
      <span
        aria-hidden
        className={`absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full transition-colors duration-150 ${
          done ? 'bg-crimson' : 'bg-line group-hover:bg-crimson/40'
        }`}
      />
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 h-0.5 bg-crimson ${
          pressing ? 'w-full transition-[width] duration-500 ease-linear' : 'w-0 transition-none'
        }`}
      />

      {/* 推进器：语义控件仍是 button（可聚焦、可键盘操作），点它 = 推进一步 */}
      <button
        type="button"
        aria-label={`${done ? '取消完成' : `推进到第 ${cur + 1} 步`}：${unit.label}`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation();
          if (swallowClick()) return;
          onMain();
        }}
        className="group/dia flex h-4.5 w-4.5 flex-none cursor-pointer items-center justify-center"
      >
        <i
          className={`flex h-3 w-3 rotate-45 items-center justify-center border transition-colors duration-220 ease-genso ${mark} group-hover/dia:bg-crimson/15`}
        >
          {/* 进行中的内芯：不靠颜色深浅说谎，明确表示"走到一半" */}
          {cur > 0 && !done ? <i className="block h-1 w-1 bg-crimson" /> : null}
        </i>
      </button>

      {/* 组图标独占一列 —— 与单条卡同站位（参考稿 `.entry .glyph`），标题与下各行左对齐 */}
      <Icon
        name={CYCLE_ICON[step.cycle]}
        size={17}
        className={`mt-0.5 flex-none ${done ? 'text-ink-3' : 'text-gold-hi'}`}
      />

      <div className="min-w-0 flex-1">
        <h3
            className={`flex min-w-0 flex-wrap items-center gap-1.5 break-words text-base font-semibold leading-snug tracking-card ${
              done ? 'text-ink-3 line-through decoration-crimson decoration-1' : 'text-ink'
            }`}
          >
            {unit.label}
            {/* 菱形进度格：一格 = 一步，三态与左侧推进器同源（所以"走到第几步"是一排看得见的菱形） */}
            <span aria-hidden className="flex items-center gap-[3px]">
              {unit.items.map((it, i) => (
                <i
                  key={it.id}
                  className={`block h-1.5 w-1.5 rotate-45 border transition-colors duration-220 ease-genso ${
                    i < cur
                      ? 'border-crimson bg-crimson'
                      : i === cur && !done
                        ? 'border-crimson'
                        : 'border-gold'
                  }`}
                />
              ))}
            </span>
            {/* 计数：等宽字体，数字不跳（参考稿的 `.cnt`） */}
            <span className="font-mono text-sm text-gold-hi">
              {cur}
              <span className="text-ink-4">/{unit.total}</span>
            </span>
            {done ? <SnakeEye size={13} className="ml-1" /> : null}
            {card.tags && showDeadline && earliest ? <DeadlineTag item={earliest} /> : null}
            {card.tags && unit.items[0].autoDaily ? <CoveredTag /> : null}
            {card.tags && unit.items[0].premium ? <PremiumTag /> : null}
            {/* 时间窗只在全组一致时显示；不一致时整项不显示（见文件头） */}
            {card.tags && sameTime ? <TimeTag item={step} /> : null}
        </h3>

        {/* 收益与类型同样"全组一致才显示" —— 逐次收益不同的组不显示，避免被读成合计。
            提示文案沿用数据里的 `gainNote`（如"每只 20 勾"，它本来就说明了这是**单次**收益），
            全组口径不一致时不写 title，让徽章自己说话。站位随断点（移动正文流 / 桌面右列） */}
        {!payColumn && card.gain && gain ? (
          <GainBadges gain={gain} note={sameOf((it) => it.gainNote)} />
        ) : null}
        {!payColumn && card.kinds && kinds ? (
          <KindBadges kinds={kinds} gain={gain} labels={kindLabels} />
        ) : null}

        {/* 逐次说明用**当前步**的原文：走一步换一条，这正是"分段推进"的用处 */}
        {card.path && samePath ? <Field kind="path" value={samePath} /> : null}
        {card.condition && step.condition ? <Field kind="condition" value={step.condition} /> : null}
        {card.note && step.note ? <Field kind="note" value={step.note} /> : null}
      </div>

      {/* 桌面右列（册页稿 `.entry .pay`）—— 与单条卡同一站位 */}
      {payColumn ? (
        <div className="flex-none">
          {card.gain && gain ? <GainBadges gain={gain} note={sameOf((it) => it.gainNote)} column /> : null}
          {card.kinds && kinds ? (
            <KindBadges kinds={kinds} gain={gain} labels={kindLabels} column />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * 周期 → 图标。与 `ChecklistItem` 的同一张表（分组规则要求同组同周期，
 * 所以取当前步的周期是稳定的）。两处各留一份是刻意的：这张表属于"卡片的呈现"，
 * 抽到 domain 会让 domain 反向依赖图标名。
 */
const CYCLE_ICON: Record<Item['cycle'], IconName> = {
  once: 'ofuda',
  daily: 'ema',
  weekly: 'ougi',
  monthly: 'koyomi',
  limited: 'chochin',
  version: 'nobori',
  season: 'nobori',
};

export default memo(ChecklistGroupCard);
