import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/icons/Icon';
import type { Item, ItemDraft } from '../../api/types';
import type { Cycle } from '../../domain/enums';
import { CYCLE } from '../../domain/enums';
import { buildComparator, effectiveSortBy, moveBefore, moveWithinGroup, seedOrder } from '../../domain/sort';
import { draftFromItem } from '../../domain/itemDraft';
import { hasPatch } from '../../domain/itemPatch';
import { isArchived } from '../../domain/reset';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { btn, chip, input, tag, tx } from '../../components/common/controls';
import ItemForm from '../../components/settings/ItemForm';
import { useAutoDaily } from '../../hooks/useAutoDaily';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';

/* 输入框 / 下拉一律走配方（`controls.input`）—— 别再在组件里拼圆角与字号：
   `rounded-sm` 现在是 11px、`text-lg` 是 14.5px，拼出来的小方块会"字大角圆、比按钮高一截"
   （2026-09-28 用户反馈"条目管理里的输入框感觉很奇怪"）。焦点环仍由 `base.css` 的全局
   `:focus-visible` 负责，这里只把描边在聚焦时转金 */
const inputCls = `${input.base} ${input.md}`;

/* 列表行内的小按钮：走 `btn` 配方的小号档（2026-09-28 起）——
   此前这里是本文件自己拼的一份，字号 12px 与「清空记录」「关于」里走配方的同款（11px）差一档，
   正是用户报的"折叠区里字体不统一"的一处。阶梯与配方的关系见 `controls.tx` */
const rowBtn = `${btn.base} ${btn.sm} ${btn.out}`;

/**
 * 「设置 · 条目管理」（F20 条目自定义）。
 *
 * 这里同时也是**自定义排序的唯一入口**：排序控件已按产品决策取消，
 * 一旦用户在此调整顺序，`order` 非空 → `effectiveSortBy` 判定为 custom → 直接接管默认痛感排序。
 *
 * **列表按周期分组展示、调序也限制在组内**：
 * 分组依据就是条目自身的 `cycle`（档间顺序取 `dicts.cycle` 的 sort —— 每日 → 每周 → 每月 → 限时），
 * 这样"在排序界面里看到的分类"和"条目自己的分类"永远一致。
 * 2026-09-28 由「折叠分组」（一次只展开一组）改为**页签**（用户要求"改成 tab"）：
 * 一屏只看一档，切档不改变展开高度、也不会有"点开另一个组、上面那个自己收起来"的跳动。
 * 搜索**只看当前档**，但每个页签上标出该档命中数（`hitsByTab`）—— 东西在别的档时不必逐档试。
 * 本档的**已隐藏**条目就贴在本档列表下方（浅底块），**同样参与搜索**：原先它在页面底部
 * 且搜索不覆盖它，搜一个已隐藏条目的名字会显示"没有匹配"，而它其实就在下面躺着。
 * 跨档调序被禁用而非静默无效：列表已按周期切开，跨档移动在界面上看不出任何变化，
 * 让按钮"点了没反应"比禁用更让人困惑（`domain/sort.moveWithinGroup` 的注释有详细说明）。
 *
 * **新建与编辑都是弹层**（2026-09-28 用户要求"新建用弹窗，没必要常驻"，随后"编辑也改成弹窗"）：
 * 两者共用 `components/settings/ItemForm`（表单本体 = 弹层 + 11 个字段），字段清单只写一份 ——
 * 编辑漏一个字段就等于"一保存就把那个字段删掉"（覆盖语义，见 `domain/itemDraft`）。
 * 入口：新建 = 标题右侧「新建条目」；编辑 = 每行行尾的 ✎（自建与预设都开放，预设走字段改写）。
 * 好处不只是省版面：表单长（11 个字段），弹层里它能自己滚、按钮始终在页脚可见。
 *
 * **列表只有名字**（2026-09-28 收口）：这里曾有过一个「内容」开关，打开后每条下方写出它的
 * 入口 / 条件 / 备注 / 收益 / 日期（`ItemDesc`，复用清单卡那套零件）。三轮之后整体撤掉
 * （用户要求"内容按钮和功能直接去除"）—— 用户真正要的"说明"是**填写时**的说明，那部分落在
 * `ItemForm` 每个字段下方；而这一页的主用途是调顺序 / 增删 / 找东西，要看条目内容有两条路：
 * 清单页看打卡视角的卡片，或点 ✎ 打开编辑弹层看全部字段。
 *
 * 卡内分割约定（与「设置」页其它分区一致）：
 *   **配置 / 新增 / 操作** 类子块用 `bg-surface-3` 底，**展示 / 列表** 保持白底，两者之间加 `border-t`。
 */
export default function ItemManagerSection() {
  const items = useItemStore((s) => s.items);
  const presetItems = useItemStore((s) => s.presetItems);
  const overrides = useItemStore((s) => s.overrides);
  const meta = useItemStore((s) => s.meta);
  const loadPreset = useItemStore((s) => s.loadPreset);
  const addItem = useItemStore((s) => s.addItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const hideItem = useItemStore((s) => s.hideItem);
  const restoreItem = useItemStore((s) => s.restoreItem);
  const removeItem = useItemStore((s) => s.removeItem);
  const saveOrder = useItemStore((s) => s.saveOrder);
  const resetLibrary = useItemStore((s) => s.resetLibrary);
  const pinned = useViewStore((s) => s.view.pinned);
  const askConfirm = useUiStore((s) => s.askConfirm);
  /* 一键日常的覆盖集合（2026-09-20 用户要求在这里标记）：
     用 `useAutoDaily` 而不是直读 `view.autoSet` —— 它给的是 `effectiveAutoSet` 归一后的结果
     （只含常驻每日候选、已剔除失效 id），与实际级联勾选的口径**完全一致**。
     直读 `autoSet` 会把失效 id 也算进来，"标记了却不会被入口勾上"反而误导。 */
  const { coveredSet } = useAutoDaily();

  const [query, setQuery] = useState('');
  /**
   * 当前分组页签（2026-09-28 由"按周期下拉展开"改为 **tab** —— 用户要求）。
   * 键就是周期本身（一个周期一档），档位构造见 `tabs`。
   */
  const [tab, setTab] = useState<Cycle>('daily');
  /** 是否正在新建（2026-09-28 起表单走弹层，不再常驻在列表上方） */
  const [creating, setCreating] = useState(false);
  /**
   * 正在编辑的条目（`null` = 没有在编辑）。
   *
   * 2026-09-28 两轮：先是行内表单（那时存 id，避免"编辑期间 reload 换引用"的老快照问题）；
   * 改成弹层后**可以存整条**了 —— 表单在挂载时把初值抄进自己的 state，
   * 之后 reload 换引用也不影响它；而且归档块里的条目不在 `items` 里，存整条省一次查找。
   */
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPreset();
  }, [loadPreset]);

  const order = overrides?.order ?? [];
  const orderKey = order.join(',');
  const seed = useMemo(() => seedOrder(items, pinned), [items, pinned]);
  const kindLabels = dictIndexOf(meta, 'gainKind');
  const cycleLabels = dictIndexOf(meta, 'cycle');

  /** 当前生效顺序（全量，**不做搜索过滤**）：分组页签与搜索都从它切 */
  const visibleAll = useMemo(() => {
    /* 用 orderKey 还原一份数组，避免把 `order` 引用写进依赖（它每次渲染都是新数组） */
    const orderList = orderKey ? orderKey.split(',') : [];
    return [...items].sort(
      buildComparator({ sortBy: effectiveSortBy(orderList), pinned: [...pinned], order: orderList }),
    );
  }, [items, orderKey, pinned]);

  /**
   * **已归档的自建条目**：`until` 一过，`activeItems` 就把它从 `items` 里滤掉，
   * 但它仍留在 `overrides.custom` 里 —— 于是"自建 N"一直算着它、列表里却看不到，
   * 而且再也删不掉（隐藏区只管预设）。归档的单独收一块（按当前档过滤），见下方渲染处。
   */
  const archivedCustomAll = useMemo(() => {
    const now = new Date();
    return (overrides?.custom ?? []).filter((it) => isArchived(it, now));
  }, [overrides]);

  /** 本档的已归档自建条目（列表按档切开，归档块也跟着切） */
  const archivedCustom = archivedCustomAll.filter((it) => it.cycle === activeKey);

  /* `filter(Boolean)` 不会缩窄类型，改用类型谓词去掉 `undefined` —— 否则下游到处要写 `it!`，
     非空断言一多就没人再核对它是否真的有值 */
  const hiddenItems = useMemo(
    () =>
      (overrides?.hidden ?? [])
        .map((id) => presetItems.find((it) => it.id === id))
        .filter((it): it is Item => Boolean(it)),
    [overrides, presetItems],
  );

  /**
   * 分组页签：**一个周期一档**（2026-09-28 起不再有合并档 —— 原先"版本与赛季"合成一档，
   * 那两个周期现已并入 `limited`，见 `domain/enums`）。
   *
   * 档位**跟着数据走**，只列当前真有条目的周期（**含已隐藏的**）：
   *   - 照字典铺会多出永远空的页签 —— 自建条目被真删光、某期没有常驻活动，
   *     都会留下一个点开只有"暂无条目"的空档，不如不给；
   *   - 反过来，某一档的条目**全被隐藏**时必须留着它 —— 否则那些条目再也恢复不出来。
   *
   * 顺序与档名都取字典 `cycle`（单一来源）：按 `sort` 排、档名直接用字典 label。
   * **别在这里另立一套切法。**
   */
  const tabs = useMemo(() => {
    const dict = dictIndexOf(meta, 'cycle');
    const present = new Set<Cycle>([...items, ...hiddenItems].map((it) => it.cycle));
    return CYCLE.filter((c) => present.has(c))
      .map((c) => ({
        key: c,
        label: dict.get(c)?.label ?? c,
        sort: dict.get(c)?.sort ?? 999,
      }))
      .sort((a, b) => a.sort - b.sort);
  }, [meta, items, hiddenItems]);

  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  /* 一个周期一档之后，"本档"就是一个裸的周期值 —— 不再有 `cycles` 数组。
     ⚠️ 别把它写成 `[active.key]` 这类**每帧新建的数组**：那会让下游两个 memo 的依赖
     每帧都变、memo 等于没有（eslint react-hooks/exhaustive-deps 会直接点出来）。
     用原始值 `Cycle | undefined` 做依赖，比较也只是一次 === */
  const activeKey = active?.key;
  /** 本档判定：拖放与调序都只认"同一档"，与页签看到的分组一致 */
  const inTab = (c: Cycle) => c === activeKey;

  const hiddenCount = overrides?.hidden.length ?? 0;
  const customCount = overrides?.custom.length ?? 0;

  const searching = query.trim().length > 0;
  const q = query.trim();

  /* 本档的可见条目（搜索时只留命中的）。`c === activeKey` 直接写在这里而不是调 `inTab`：
     `inTab` 每次渲染都是新函数，写进依赖会让 memo 每渲染必重算 */
  const shown = useMemo(() => {
    const list = visibleAll.filter((it) => it.cycle === activeKey);
    return q ? list.filter((it) => it.name.includes(q)) : list;
  }, [visibleAll, activeKey, q]);

  /* 本档的**已隐藏**条目 —— 与可见条目同档展示、同样参与搜索（2026-09-28）。
     原先是页面底部一个总隐藏区、且搜索不覆盖它：搜一个已隐藏的条目会看到"没有匹配"，
     而它其实就躺在下面；隐藏区恰恰是最需要搜索的地方（想恢复却忘了它在哪个周期） */
  const hiddenShown = useMemo(() => {
    const list = hiddenItems.filter((it) => it.cycle === activeKey);
    return q ? list.filter((it) => it.name.includes(q)) : list;
  }, [hiddenItems, activeKey, q]);

  /* 搜索时各档的命中数（含已隐藏）：让"东西在别的档"一眼可见，不必逐档点过去试 */
  const hitsByTab = useMemo(() => {
    if (!q) return null;
    const map = new Map<Cycle, number>();
    for (const t of tabs) {
      map.set(
        t.key,
        [...visibleAll, ...hiddenItems].filter((it) => it.cycle === t.key && it.name.includes(q))
          .length,
      );
    }
    return map;
  }, [q, tabs, visibleAll, hiddenItems]);

  /** 其它档的命中总数（本档为空时用来提示"切过去看看"） */
  const otherHits = hitsByTab
    ? [...hitsByTab.entries()].reduce((s, [k, n]) => (k === active?.key ? s : s + n), 0)
    : 0;

  /**
   * 本档没内容时那句话（2026-09-28 改页签后补）。
   * 三层信息量，按"用户最可能困惑的顺序"排：
   *   ① 搜到的东西在**下面的已隐藏里** → 直接告诉他往下看，别让人以为没搜到；
   *   ② 本档没搜到、**别的档有** → 给出条数并提示切档（搜索不再跨档铺开铺不平）；
   *   ③ 真的没有 → 就是没有。
   */
  const emptyText = !q
    ? `「${active?.label ?? ''}」这一档暂无条目，点右上角「新建条目」加一条。`
    : hiddenShown.length
      ? `匹配「${q}」的都在下面的「已隐藏」里。`
      : otherHits
        ? `「${active?.label ?? ''}」没有匹配「${q}」的条目；其它分组还有 ${otherHits} 条，切过去看看。`
        : `没有匹配「${q}」的条目。`;

  /**
   * 新增：字段校验与归一在 `ItemForm`（表单）+ `domain/itemDraft`（数据规则），
   * 这里只做"调接口 + 成功之后把界面带到那一条上"。
   */
  const createItem = async (draft: ItemDraft): Promise<boolean> => {
    setBusy(true);
    const created = await addItem(draft);
    setBusy(false);
    if (!created) return false;
    /* 加完**跳到那一条所在的档**（2026-09-28 顺手补）：页签一次只显示一档，
       不跳的话用户要自己切过去才能确认"到底加上没有"（新条目可能落在别的档里） */
    setTab(created.cycle);
    return true;
  };

  /** 编辑：保存后同样跳到该条所在的档 —— 周期可能被改（编辑里能改周期）。
   *  关弹层的动作归表单（`ItemForm` 在 `onSubmit` 返回 true 后自己调 `onClose`） */
  const saveItem = async (itemId: string, draft: ItemDraft): Promise<boolean> => {
    setBusy(true);
    const updated = await updateItem(itemId, draft);
    setBusy(false);
    if (!updated) return false;
    setTab(updated.cycle);
    return true;
  };

  /**
   * 「还原默认」：把**种子原值**反推成草稿提交 —— 改写是"对着种子求差"的，
   * 差异为空就自动消失，不必另开一个"删改写"的接口。
   * 种子从 `presetItems`（完整预设池，含被隐藏的）里取，不是从生效条目取 ——
   * 生效条目本身就带着改写，拿它反推等于把改写又盖一遍。
   */
  const resetItem = async (it: Item): Promise<boolean> => {
    const seed = presetItems.find((p) => p.id === it.id);
    if (!seed) return false;
    const ok = await askConfirm({
      title: `还原「${it.name}」的默认内容？`,
      body: '会丢弃你对这条预设条目的全部改写，恢复随数据版本发布的样子。勾选状态与自定义顺序不受影响。',
      confirmLabel: '还原默认',
      tone: 'danger',
    });
    if (!ok) return false;
    setBusy(true);
    const updated = await updateItem(it.id, draftFromItem(seed));
    setBusy(false);
    if (!updated) return false;
    /* 还原走的是"提交一份种子草稿"，不是表单的保存按钮 —— 所以关闭由这里负责 */
    setEditingItem(null);
    return true;
  };

  /** 档内 ▲▼：档边界不动作 —— 这里的"组"就是当前页签的那一档（含合并档的两类周期） */
  const moveInGroup = (group: Item[], id: string, dir: -1 | 1) => {
    /* 一键日常入口锁死（2026-09-29 用户要求"禁止修改和移动顺序"）—— 理由见 `dropOn` 与本行的
       `isAutoHub` 分支：它恒第 0 位，写进 `order` 唯一的效果是把排序模式切成"自定义" */
    if (items.some((x) => x.id === id && x.isAutoHub)) return;
    void saveOrder(
      moveWithinGroup(
        order,
        group.map((x) => x.id),
        id,
        dir,
        seed,
      ),
    );
  };

  /** 拖放：只接受**同一档内**的落点，跨档落点直接忽略（界面按档切开，跨档移动看不见效果） */
  const dropOn = (target: Item) => {
    const from = dragId ? items.find((x) => x.id === dragId) : undefined;
    setDragId(null);
    if (!from || from.id === target.id) return;
    /**
     * 一键日常入口**既不可被拖走、也不接受落点**（2026-09-29 用户要求"禁止修改和移动顺序"）。
     *
     * 不只是"拖了没用"：`domain/merge.effectiveView` 的 `order` 一旦非空，
     * `domain/sort.effectiveSortBy` 就判定为 `custom` —— 而 hub 自己受 `buildComparator`
     * 的前置特判保护、**恒第 0 位、不读 `order`**。于是拖它的实际结果是：
     * 列表顺序一点没变，整页排序却从"默认痛感"悄悄切成了"自定义"（用户改不动的东西
     * 反而改掉了他没打算改的东西）。落点侧同理 —— 拖别的条目到它上面也会写进 `order`。
     */
    if (from.isAutoHub || target.isAutoHub) return;
    if (!inTab(from.cycle) || !inTab(target.cycle)) return;
    void saveOrder(moveBefore(order, from.id, target.id, seed));
  };

  return (
    <CollapsibleSection
      title="条目管理"
      summary={`共 ${items.length} 条 · 自建 ${customCount} · 隐藏 ${hiddenCount}${
        archivedCustomAll.length ? ` · 归档 ${archivedCustomAll.length}` : ''
      }`}
      aside={
        <>
          {/* 新建入口（2026-09-28）：表单改成弹层后，这里就是它唯一的入口 ——
              放在分区标题右侧，和「恢复默认」同一档小按钮，不抢列表的视线 */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(true)}
            className={rowBtn}
          >
            <Icon name="plus" size={12} />
            新建条目
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await askConfirm({
                title: '恢复默认条目库？',
                body: '将清空全部自建条目、对预设条目的改写、已隐藏记录与自定义顺序。此操作不可撤销。',
                confirmLabel: '恢复默认',
                tone: 'danger',
              });
              if (ok) void resetLibrary();
            }}
            className={rowBtn}
          >
            <Icon name="restore" size={12} />
            恢复默认
          </button>
        </>
      }
    >
      {/* ── 搜索 + 排序说明 ──
          （新建区 2026-09-28 撤了：表单改成弹层，入口是标题右侧那颗「新建条目」；
            这里的 `border-t` 也一并去掉 —— 它原本是为了与上方的新增区分层） */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索条目名称"
          aria-label="搜索条目"
          className={`${inputCls} md:w-56`}
        />
        <span className={`${tx.note} text-ink-3`}>
          点页签切换<b className="font-medium text-ink-2">周期分组</b>；
          拖动或点 ▲▼ 只在<b className="font-medium text-ink-2">本档内</b>调整 ——
          顺序一旦调整，会直接接管默认的痛感排序
        </span>
        <span className={`${tx.note} text-ink-3`}>
          带<b className="font-medium text-ink-2">日常覆盖</b>标记的条目属于一键日常的覆盖集合，
          勾选今日页入口时会一并勾选（在「一键日常覆盖」里调整）；
          带<b className="font-medium text-ink-2">一键入口</b>标记的那一条是今日页的入口卡本身，
          恒排首位、不参与调序，所以不可编辑与拖动
        </span>
      </div>

      {/* ── 分组页签（2026-09-28：由"按组下拉"改为 tab，用户要求）──
          用 `chip` 配方而不是 `Segmented`：档数随数据浮动、档名长短不一，
          而 `Segmented` 的胶囊轨道是 `flex-none` 单行 —— 窄屏会横向溢出；chip 行可换行，
          且它与本页「奖励类型」是同一套标签语言 */}
      <div
        role="group"
        aria-label="周期分组"
        className="flex flex-wrap items-center gap-1.5 border-t border-line-faint px-3 pb-0.5 pt-2.5"
      >
        {tabs.map((t) => {
          const on = t.key === active?.key;
          const hits = hitsByTab?.get(t.key) ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(t.key)}
              className={`${chip.base} ${chip.sm} ${on ? chip.on : chip.off}`}
            >
              {t.label}
              {/* 搜索时在档名后跟命中数：东西在别的档时不必逐档点过去试 */}
              {hitsByTab ? (
                <span className={`font-mono ${hits ? 'text-gold-hi' : 'opacity-50'}`}>{hits}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── 本档的条目（可调序 / 编辑 / 隐藏 / 删除）── */}
      <div className="px-3 py-2">
        {shown.length ? (
          shown.map((it, idx) => {
            /**
             * 一键日常入口（`isAutoHub`）在这一页是**只读行**（2026-09-29 用户要求
             * "禁止修改和移动顺序"）：不渲染拖动柄与 ▲▼、不给 ✎。
             *
             * 为什么不是"直接隐藏"：它确实在今日页首屏，藏起来会让"共 N 条"与能数到的行数对不上，
             * 用户第一反应是"条目丢了"而不是"它被保护了"。留一行只读 + 一句为什么，比消失更省解释。
             */
            const isHub = Boolean(it.isAutoHub);
            return (
            <div
              key={it.id}
              draggable={!isHub}
              onDragStart={() => {
                if (!isHub) setDragId(it.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!isHub) dropOn(it);
              }}
              className="flex flex-wrap items-center gap-2 rounded-sm px-1 py-1.5 transition-colors duration-120 hover:bg-surface-3"
            >
              {/* 首行：拖动柄 + ▲▼ + 名称 + 标记 + 操作（这一层原样不动） */}
              {isHub ? (
                /* 占位宽与拖动柄等宽（`grip` 的 14px），保住后面各列的对齐 */
                <span className="w-3.5 flex-none" aria-hidden />
              ) : (
                <Icon name="grip" size={14} className="flex-none cursor-grab text-line" />
              )}
              {isHub ? (
                <span className="w-3.5 flex-none" aria-hidden />
              ) : (
                <div className="flex flex-none flex-col">
                  <button
                    type="button"
                    aria-label={`在「${active?.label ?? ''}」内上移：${it.name}`}
                    title="在本档内上移"
                    disabled={idx === 0}
                    onClick={() => moveInGroup(shown, it.id, -1)}
                    className="cursor-pointer text-ink-4 transition-colors duration-120 hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Icon name="chevron-up" size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`在「${active?.label ?? ''}」内下移：${it.name}`}
                    title="在本档内下移"
                    disabled={idx === shown.length - 1}
                    onClick={() => moveInGroup(shown, it.id, 1)}
                    className="cursor-pointer text-ink-4 transition-colors duration-120 hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Icon name="chevron-down" size={13} />
                  </button>
                </div>
              )}
              <span className={`min-w-0 flex-1 break-words ${tx.rowName} text-ink`}>{it.name}</span>
              {/* 多次任务标出步数：子步骤**不单独成行**，不标的话从这一行看不出它要做 N 次
                  （清单页那张卡有菱形进度格，这里只有一行字，所以补一个标记） */}
              {it.children?.length ? (
                <span
                  title={`做 ${it.children.length} 次：清单上是一张卡，点一下推进一格`}
                  className={`${tag.base} ${tag.mute}`}
                >
                  ×{it.children.length}
                </span>
              ) : null}
              {it.origin === 'custom' ? (
                <span className={`${tag.base} ${tag.gold}`}>自建</span>
              ) : null}
              {/* 预设被改写过：标出来 —— 否则"这条内容与随包数据不同"没有任何痕迹可查 */}
              {it.origin !== 'custom' && hasPatch(overrides?.patches, it.id) ? (
                <span
                  title="这条预设的内容被你改写过：点 ✎ 继续改，或在编辑态里「还原默认」"
                  className={`${tag.base} ${tag.mute}`}
                >
                  已改写
                </span>
              ) : null}
              {/* 属于一键日常覆盖集合（2026-09-20 用户要求）：
                  用中性灰而非品牌紫 —— 紫色在本页已经是「自建」（来源）的语义，
                  两个含义不同的徽章用同一种颜色，等于两个都没说清。
                  只标记、不加点击跳转：这里是"看清楚有哪些"，改覆盖集合仍走它的专属分区。 */}
              {coveredSet.has(it.id) ? (
                <span
                  title="属于一键日常的覆盖集合：勾选今日页的入口时会一并勾选它"
                  className={`${tag.base} ${tag.mute}`}
                >
                  日常覆盖
                </span>
              ) : null}
              {/* 编辑：**自建与预设都开放**（2026-09-28）。预设走的是一层字段改写，
                  种子数据本身不动 —— 理由见 `domain/itemPatch`。
                  一键日常入口除外：它由数据维护，改了名字 / 备注只会让今日页那张卡与覆盖说明对不上 */}
              {isHub ? (
                <span
                  title="一键日常入口：内容随数据版本发布，恒排在本档第一位、不参与排序。要调整它覆盖哪些条目，去「一键日常覆盖」分区"
                  className={`${tag.base} ${tag.gold}`}
                >
                  一键入口 · 固定首位
                </span>
              ) : (
                <button
                  type="button"
                  title={`编辑条目：${it.name}`}
                  aria-label={`编辑条目：${it.name}`}
                  onClick={() => setEditingItem(it)}
                  className="flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-gold-hi"
                >
                  <Icon name="fude" size={13} />
                </button>
              )}
              {it.origin === 'custom' ? (
                <button
                  type="button"
                  title={`删除自建条目：${it.name}（不可恢复）`}
                  aria-label={`删除自建条目：${it.name}`}
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: `删除自建条目「${it.name}」？`,
                      body: '自建条目是真删（预设条目才可以只隐藏），此操作不可恢复。',
                      confirmLabel: '永久删除',
                      tone: 'danger',
                    });
                    if (ok) void removeItem(it.id);
                  }}
                  className="flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-danger"
                >
                  <Icon name="trash" size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  title={`隐藏预设条目：${it.name}（可恢复）`}
                  aria-label={`隐藏预设条目：${it.name}`}
                  onClick={() => void hideItem(it.id)}
                  className={rowBtn}
                >
                  隐藏
                </button>
              )}
            </div>
            );
          })
        ) : (
          <p className={`px-1 py-3 ${tx.note} text-ink-3`}>{emptyText}</p>
        )}

        {/* 本档的**已隐藏**条目（2026-09-28 用户要求：每个分组里独立展示隐藏的内容）——
            与可见条目同档、同样参与搜索。浅底块让它一眼区别于"在用的条目"；
            右侧只给「恢复」：隐藏条目不参与调序（它们不在生效顺序里） */}
        {hiddenShown.length ? (
          <div className="mt-2 rounded-sm border border-line-faint bg-surface-3 px-3 py-2.5">
            <p className={`${tx.label} text-ink-2`}>
              已隐藏 · {hiddenShown.length} 条 · 可恢复
              {searching ? <span className="ml-1">（本档内匹配「{q}」的）</span> : null}
            </p>
            <div className="mt-1.5">
              {hiddenShown.map((it) => (
                <div key={it.id} className="py-1">
                  <div className="flex items-center gap-2">
                    {/* 已隐藏 = 下线态：行名降一档（`tx.rowName` + `text-ink-3`）*/}
                    <span className={`min-w-0 flex-1 break-words ${tx.rowName} text-ink-3`}>{it.name}</span>
                    <button
                      type="button"
                      title={`恢复预设条目：${it.name}`}
                      aria-label={`恢复预设条目：${it.name}`}
                      onClick={() => void restoreItem(it.id)}
                      className={rowBtn}
                    >
                      <Icon name="undo" size={12} />
                      恢复
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 本档的**已归档**自建条目（2026-09-28）：`until` 一过，条目就从生效列表里下线 ——
            但它在 `overrides.custom` 里**还在**（"自建 N" 一直算着它），
            若这里不列出来，用户会看到"自建 3 条、却只能数到 2 行"，而且那条**再也删不掉**
            （隐藏区只管预设）。所以归档的给一个归宿：能改归档日让它重新上线、也能真删。
            预设不在此列：它们是数据维护的（活动结束由 `limited.db.json` 那边删条目），
            列表里堆一整年的过期活动只会变成噪声 */}
        {archivedCustom.length ? (
          <div className="mt-2 rounded-sm border border-line-faint bg-surface-3 px-3 py-2.5">
            <p className={`${tx.label} text-ink-2`}>
              已归档 · {archivedCustom.length} 条 · 到了归档日自动下线
              <span className="ml-1">（把归档日改到以后就能重新上线）</span>
            </p>
            <div className="mt-1.5">
              {archivedCustom.map((it) => (
                <div key={it.id} className="py-1">
                  <div className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 break-words ${tx.rowName} text-ink-3`}>{it.name}</span>
                    <button
                      type="button"
                      title={`编辑条目：${it.name}`}
                      aria-label={`编辑条目：${it.name}`}
                      onClick={() => setEditingItem(it)}
                      className="flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-gold-hi"
                    >
                      <Icon name="fude" size={13} />
                    </button>
                    <button
                      type="button"
                      title={`删除自建条目：${it.name}（不可恢复）`}
                      aria-label={`删除自建条目：${it.name}`}
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: `删除自建条目「${it.name}」？`,
                          body: '自建条目是真删（预设条目才可以只隐藏），此操作不可恢复。',
                          confirmLabel: '永久删除',
                          tone: 'danger',
                        });
                        if (ok) void removeItem(it.id);
                      }}
                      className="flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-danger"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 弹层（2026-09-28）：新建 / 编辑共用 `ItemForm`，关掉即卸载 ── */}
      {creating ? (
        <ItemForm
          mode="create"
          busy={busy}
          cycleLabels={cycleLabels}
          kindLabels={kindLabels}
          onSubmit={createItem}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editingItem ? (
        <ItemForm
          mode="edit"
          initial={editingItem}
          busy={busy}
          cycleLabels={cycleLabels}
          kindLabels={kindLabels}
          onSubmit={(draft) => saveItem(editingItem.id, draft)}
          onClose={() => setEditingItem(null)}
          /* 「还原默认」只对**被改写过的预设**给：提交一份种子原值反推的草稿，
             与种子的差异为空 → 改写被删掉（见 `domain/itemDraft.draftFromItem`） */
          onReset={
            editingItem.origin !== 'custom' && hasPatch(overrides?.patches, editingItem.id)
              ? () => void resetItem(editingItem)
              : undefined
          }
        />
      ) : null}
    </CollapsibleSection>
  );
}
