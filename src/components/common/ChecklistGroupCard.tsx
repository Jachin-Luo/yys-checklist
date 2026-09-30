import { memo } from 'react';
import type { Item } from '../../api/types';
import { currentStepIndex, doneSteps, stepIds, stepView } from '../../domain/steps';
import { useCardDisplay } from '../../hooks/useCardDisplay';
import { LONG_PRESS_MS, useLongPress } from '../../hooks/useLongPress';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useCheckStore } from '../../stores/check';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';
import { CoveredTag, PremiumTag, RewardBadges } from './RewardBadges';
import { Field, FieldBlock } from './ItemField';
import { DeadlineTag, TimeTag } from './Tags';
import Icon, { type IconName } from '../icons/Icon';
import { SnakeEye } from '../ornament';

/**
 * 超过这个步数就不画菱形格了：31 个菱形会把标题挤没（用户定的阈值）。
 * 超过时改画**竖条**（重设计样式稿的 `.prog .bars`），不是"干脆不画" —— 见文件头。
 */
const DIAMOND_MAX = 7;

/**
 * **多次卡**：「同一件事做 N 次」的任务（2026-09-28 子组模型）。
 *
 * 数据是**一个父条目 + N 个子步骤**（`Item.children`），不是 N 条平级条目 ——
 * 所以"这是不是一组""有几步""走到第几步"全是事实，不用猜（2026-09-24 那版是按名字
 * 里的 `k/N` 猜的，连带一整套"缺员仍要聚合""成员豁免筛选"的补丁，随本版一起删除）。
 *
 * ## 与 `ChecklistItem`（单条卡）的关系
 *
 * 外壳、颜色、动效全部同构（同一套令牌类），差异只在**三个地方**：
 *
 * | | 单条卡 | 多次卡 |
 * |---|---|---|
 * | 左侧菱形 | 勾选框：点一下 = 完成 / 取消 | **推进器**：点一下 = 完成下一步；满段后再点 = 取消整卡 |
 * | 标题行 | 任务名 | 任务名 + **菱形进度格**（一格一步）+ **`cur/total` 等宽计数** |
 * | 逐次说明 | 恒显示本条自己的 | 显示**当前这一步**的（`地域鬼王` 第 2 步的"需声望 2000"只在推进到那一步时出现） |
 *
 * 外壳代码与 `ChecklistItem` 是重复的（两份 `article` + 竖条 + 底轨）。**暂时不抽公共壳**：
 * 抽壳要引入一层 slot 协议，而现在只有两张卡；等第三张出现再抽，比先抽错便宜。
 *
 * ## 三个交互决策（沿用 2026-09-24 那版，用户 2026-09-28 确认不动）
 *
 * 1. **点整卡 = 点菱形 = 推进一步**（不另设"一键完成整组"）：与"点一次菱形推进一步"
 *    一致；否则整卡一点就满段，"分段推进"就没有意义了。
 * 2. **满段后再点 = 取消整卡**（把所有步一起清掉），与单条卡"再点一次取消"同源。
 * 3. **长按 = 把当前进度复刻到其他账号**：把「下一步 + 已完成的那些步」一起写过去，
 *    `toggleInProfiles` 的方向由**第一个 id** 决定，所以第一个必须放"下一步"（它必然是
 *    未完成 → 整批按"勾选"写），目标账号拿到的正好是"前 cur+1 步已完成"。
 *    满段时长按传整卡（第一个已完成 → 整批按"取消"写），语义是撤销。
 *
 * **不做中间回退**（2026-09-28 用户决定）：做了 2/3 想退回 1/3 是做不到的 ——
 * 不做乱序勾选，就只能一路推进、或到满段后整卡取消。
 *
 * ## 两种进度形式（按步数切）
 *
 * | 步数 | 形式 | 出处 |
 * |---|---|---|
 * | ≤ `DIAMOND_MAX`（7） | **菱形格**：三态（金描边空心 → 朱红描边 = 当前步 → 朱红实心 = 已完成） | 参考稿的进度格 |
 * | > 7（上限 31） | **竖条**：两态（`line` 灰 = 未做 / `crimson` 朱红 = 已做） | `uiRef/囤囤鼠大作战_重设计样式稿.html` 的 `.prog .bars` |
 *
 * 为什么切：菱形一枚约 9px 宽（6px + 间距），31 步接近 280px，会把标题挤没；
 * 竖条 3px + 2px 间距，31 步约 153px，还留在标题行里 —— 用户 2026-09-28 定的
 * 「超过 7 个时用重设计样式稿里的形式」，所以是**换一种画法**，不是"干脆不画"。
 *
 * 竖条只有两态：步数一多，"当前步是哪一步"由紧随其后的 `cur/total` 说更准
 * （样式稿的 `.prog` 也是这个取舍：条只分 on / off，数字另说）。
 *
 * 两者都纯装饰（`aria-hidden`）：读屏器由紧随其后的 `cur/total` 承担。
 *
 * ## 逐次不同的字段显示"当前步"
 *
 * 子步骤只写差异（奖励 / 条件 / 备注 / 时间备注），没写的**继承父**（`stepView`）。
 * 所以卡上显示的是**当前步合并后的视图**：走一步换一条说明、换一份奖励 ——
 * 这正是"分段推进"的用处，也是"每步奖励可以不同"落在界面上的样子。
 * 周期 / 时间 / 入口 / 截止这类字段父条目说了算（子步骤不许覆盖），直接读父。
 */
function ChecklistGroupCard({
  item,
  dimmed = false,
  showDeadline = false,
  highlight = false,
}: {
  item: Item;
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
  /* 多次卡只出现在四个清单页里，按当前页面取自 `useCardDisplay`（设置页不预览它） */
  const card = useCardDisplay();
  const pinnedIds = useViewStore((s) => s.view.pinned);
  const setPinned = useViewStore((s) => s.setPinned);
  const askPick = useUiStore((s) => s.askPick);

  const steps = item.children ?? [];
  const ids = stepIds(item);
  const isDone = (id: string) => checked[id] !== undefined;
  const cur = doneSteps(item, isDone);
  const done = cur === steps.length;
  /* 当前步：未满段时是"下一步"，满段后退回最后一步（卡上仍能读到那一步的说明，不会突然空掉） */
  const step = stepView(item, currentStepIndex(item, isDone));

  const kindLabels = new Map([...dictIndexOf(meta, 'gainKind').entries()].map(([k, v]) => [k, v.label]));

  /* 推进一步：勾掉下一个未完成的步 */
  const advance = () => void toggle(ids[cur]);
  /* 满段后再点：整卡一起取消（`setMany` 传 null 即清掉这些 id） */
  const reset = () => void setMany(ids, null);
  const onMain = () => (done ? reset() : advance());

  const { handlers, pressing, swallowClick } = useLongPress({
    duration: LONG_PRESS_MS,
    onLongPress: () => {
      void (async () => {
        const picked = await askPick({
          itemId: step.id,
          itemName: item.name,
          checked: done,
        });
        if (!picked?.length) return;
        const payload = done ? ids : [step.id, ...ids.slice(0, cur)];
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
  /* 置顶只看父条目：子步骤不进置顶表（粒度锁在父，见 `SubItem` 的说明） */
  const allPinned = pinnedIds.includes(item.id);
  const showDiamonds = steps.length <= DIAMOND_MAX;

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
      data-total={steps.length}
      className={[
        /* 账目行（册页稿 `.entry`）：与单条行同构；进度不再画底轨 —— 标题行里的
           菱形进度格 + `cur/total` 已经把"走到第几步"说清了。
           底色与分隔口径与 `ChecklistItem` **逐字一致**（底色互斥三元 + 行自己的
           `border-t` 分界，理由见那一处注释）—— 两种行在同一屏相邻出现，规则必须是一份。 */
        'group no-press-select relative flex cursor-pointer items-start gap-1.5 border-t border-line-soft px-3 py-2.5 transition-colors duration-150 ease-genso first:border-t-0',
        isHighlight
          ? 'bg-gold-soft ring-1 ring-gold-line'
          : done
            ? 'bg-card-done'
            : 'bg-surface hover:bg-fill',
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
      {/* 长按进度：与单条卡同款 —— 两端内缩的圆角轨道，进度条不会伸出行的圆角之外 */}
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

      {/* 推进器：语义控件仍是 button（可聚焦、可键盘操作），点它 = 推进一步。
          与单条卡的菱形同规格：**20px 外框内居中**（第一排对齐基准） */}
      <span className="flex h-5 flex-none items-center">
        <button
          type="button"
          aria-label={`${done ? '取消完成' : `推进到第 ${cur + 1} 步`}：${item.name}`}
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
      </span>

      {/* 组图标独占一列 —— 与单条卡同站位（参考稿 `.entry .glyph`），标题与下各行左对齐。
          第一排的对齐基准同样是 **20px 框内居中**（推进器 / 组图标 / 标题首行 / 行内标签 /
          置顶按钮的中线都落在 10px），口径与理由见 `ChecklistItem` 菱形那处 */}
      <span className="flex h-5 flex-none items-center">
        <Icon
          name={CYCLE_ICON[item.cycle]}
          size={17}
          className={`flex-none ${done ? 'text-ink-3' : 'text-gold-hi'}`}
        />
      </span>

      <div className="min-w-0 flex-1">
        <h3
            /* `leading-5`（20px）= 第一排对齐基准，与左右两件的外框 `h-5` 同高（见单条卡同名说明） */
            className={`flex min-h-5 min-w-0 flex-wrap items-center gap-1.5 break-words text-base font-semibold leading-5 tracking-card ${
              done ? 'text-ink-3 line-through decoration-crimson decoration-1' : 'text-ink'
            }`}
          >
            {item.name}
            {/* 菱形进度格：一格 = 一步，三态与左侧推进器同源（所以"走到第几步"是一排看得见的菱形） */}
            {showDiamonds ? (
              <span aria-hidden className="flex items-center gap-[3px]">
                {steps.map((it, i) => (
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
            ) : (
              /* 竖条（重设计样式稿 `.prog .bars`）：3×11px 的细条比菱形省一半宽度，
                 14 步约 68px、31 步约 153px，都还待在标题行里；菱形到 31 步要 280px，
                 会把标题挤没。两态即可 —— "走到第几步"由紧随其后的计数说 */
              <span aria-hidden className="flex items-center gap-[2px]">
                {steps.map((it, i) => (
                  <i
                    key={it.id}
                    className={`block h-[11px] w-[3px] rounded-[1px] transition-colors duration-220 ease-genso ${
                      i < cur ? 'bg-crimson' : 'bg-line'
                    }`}
                  />
                ))}
              </span>
            )}
            {/* 计数：等宽字体，数字不跳（参考稿的 `.cnt`） */}
            <span className="font-mono text-sm text-gold-hi">
              {cur}
              <span className="text-ink-4">/{steps.length}</span>
            </span>
            {done ? <SnakeEye size={13} className="ml-1" /> : null}
            {card.tags && showDeadline && step.deadline ? <DeadlineTag item={step} /> : null}
            {card.tags && item.autoDaily ? <CoveredTag /> : null}
            {card.tags && item.premium ? <PremiumTag /> : null}
            {card.tags && step.time ? <TimeTag item={step} /> : null}
        </h3>

        {/* 收益取**当前步**的：逐次不同的奖励写在子步骤上，走一步换一份 ——
            提示文案沿用 `gainNote`（如"每只 20 勾"，它本来就说明这是**单次**收益）。
            固定与浮动合成一串（2026-09-29），两个显示开关仍各自生效 */}
        {!payColumn ? (
          <RewardBadges
            gain={card.gain ? step.gain : undefined}
            kinds={card.kinds ? step.gainKind : undefined}
            labels={kindLabels}
            note={step.gainNote}
          />
        ) : null}

        {/* 入口读父（子步骤不覆盖）；条件与备注读**当前步**的原文：走一步换一条，
            这正是"分段推进"的用处。与单条卡同口径：三行共用一个 `FieldBlock`，全关时不渲染 */}
        {(card.path && item.path) || (card.condition && step.condition) || (card.note && step.note) ? (
          <FieldBlock>
            {card.path && item.path ? <Field kind="path" value={item.path} /> : null}
            {card.condition && step.condition ? <Field kind="condition" value={step.condition} /> : null}
            {card.note && step.note ? <Field kind="note" value={step.note} /> : null}
          </FieldBlock>
        ) : null}
      </div>

      {/* 桌面右列（册页稿 `.entry .pay`）—— 与单条卡同一站位 */}
      {payColumn ? (
        <div className="flex-none">
          <RewardBadges
            gain={card.gain ? step.gain : undefined}
            kinds={card.kinds ? step.gainKind : undefined}
            labels={kindLabels}
            note={step.gainNote}
            column
          />
        </div>
      ) : null}

      {/* 置顶：只写父条目一个 id —— 子步骤不进置顶表，否则排序会把一张卡拉散。
          与单条卡同款：按下即 `stopPropagation`，否则在它身上按住会触发整卡的长按选择器，
          而整卡点击是"推进一步" */}
      <button
        type="button"
        aria-label={allPinned ? `取消置顶：${item.name}` : `置顶：${item.name}`}
        title={allPinned ? '取消置顶' : '置顶这一组'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void setPinned([item.id], !allPinned);
        }}
        /* `h-5` + `items-center`：星标中线与第一排其余元素同为 10px（不再用 `mt-0.5` 手调） */
        className={`flex h-5 flex-none cursor-pointer items-center rounded-full px-1 transition-colors duration-150 ease-genso hover:bg-fill ${
          allPinned ? 'text-gold-hi' : 'text-ink-4 hover:text-gold-hi'
        }`}
      >
        <Icon name="pin" size={13} className={allPinned ? '' : 'opacity-60'} />
      </button>
    </article>
  );
}

/**
 * 周期 → 图标。与 `ChecklistItem` 的同一张表（子步骤不覆盖周期，所以读父条目是稳定的）。
 * 两处各留一份是刻意的：这张表属于"卡片的呈现"，
 * 抽到 domain 会让 domain 反向依赖图标名。
 */
const CYCLE_ICON: Record<Item['cycle'], IconName> = {
  daily: 'ema',
  weekly: 'ougi',
  monthly: 'koyomi',
  limited: 'chochin',
};

export default memo(ChecklistGroupCard);
