import type { Item } from '../api/types';

/**
 * 渲染层聚合：把「同一件事的第 k / N 次」并成一张卡（2026-09-24 用户需求，方案 B）。
 *
 * ## 背景：为什么是"渲染时聚合"而不是"数据改成一条带计数的条目"
 *
 * 数据里的"多次"是 **2026-09-20 有意拆开的行**（数据版本名即「常驻条目按次数拆分」）：
 *
 * ```
 * daily_demon_lord_1  地域鬼王 1/3   （gain 各 20 勾 · note 逐次不同）
 * daily_demon_lord_2  地域鬼王 2/3
 * daily_demon_lord_3  地域鬼王 3/3
 * weekly_zhenshe_1    真·八岐大蛇 1/2
 * weekly_banquet_1    阴阳寮宴会 1/2
 * ```
 *
 * 那次拆分换来的是**逐次的信息与收益**（`2/3` 那条自己写着"需声望 2000"、
 * `3/3` 写着"需声望 10000"）。若改成"一条 + `times` 字段"，这些逐次说明要么被合并
 * （有损），要么塞进同一张卡（等于又要分段）；而且 `Checked` 是布尔时间戳，
 * 要表达"第几次"就得改**已发布的数据形状**（本地分片 + 备份 + 日志 + 统计口径 + 21 个测试文件）。
 *
 * 于是走这条路：**数据一行不改**，只在渲染时按名字把同组的几行并成一张卡，
 * 进度 = **组内真实已完成的条数**（不是伪造的计数）。
 *
 * ## 聚合规则（2026-09-24 修订：**缺员仍然聚合**）
 *
 * 一条条目要参与聚合，必须同时满足：
 *
 *   1. `name` 形如 `<组名> <k>/<N>`（半角斜杠、`N ≥ 2`、`1 ≤ k ≤ N`）；
 *   2. 同组各条的 `cycle` 与 `path` **完全相同**（周期或入口不同的行不是同一件事）；
 *   3. 同组**至少 2 个成员**，且各自的 `k` **互不重复**。
 *
 * 初版还要求"`k` 恰好凑齐 `1..N`"，**在用户第二次反馈"地域鬼王还是没有合并"之后去掉**。
 * 那条要求把一个分组的存在性绑在了"这条此刻在不在渲染数组里"上 —— 而数组会被两层裁掉成员：
 *
 *   - **视图筛选**（`isVisible` 的奖励类型过滤 / 星期不适用、`hiddenByCover` 的覆盖隐藏；
 *     那时还有一条「隐藏已完成」，勾掉第一步就会触发它，已于同日整体删除）
 *     —— 于是剩下的两步"凑不齐"而**静默散成两张卡**；
 *   - **用户手动隐藏**（`overrides.hidden`，条目库层就没了这一条）。
 *
 * 而没动过的组（真·八岐大蛇 / 寮宴会）不会缺员，所以表现成了"只有地域鬼王不合并"——
 * 这个不对称正是判据绑错了层的证据：**判定分组该用条目库，不该用"当前列表里恰好剩下的项"。**
 * 过滤器只能决定"这条自己显不显示"，不能决定"这个分组存不存在"。
 *
 * 于是分成两手：
 *   - `groupedMemberIds` 给出分组成员，供列表编排把被**视图筛选**滤掉的成员捞回来
 *     （`useChecklist`，豁免仅限视图筛选）；
 *   - 被用户**手动隐藏**的成员不强行复活（那是他的明确取舍，复活了还会被误勾），
 *     此时按**可见步数**聚合与计进度（`total = 成员数`）—— 宁可显示"2 步"，
 *     也不要显示"3 步"却永远做不完。
 *
 * 仍然退回单条的情形：只有一个成员、`k` 重复（数据真矛盾）、周期或入口不同。
 * "宁可少聚合，不可错聚合"并没有被取消，只是把"缺员"从"不可聚合"里拿掉了。
 * 解析用的是名字而不是 id：id 是内部标识（`daily_demon_lord_1`），
 * 名字才是"用户看到的分组依据"，两者不一致时以用户看到的那份为准。
 *
 * ## 顺序
 *
 * 组的渲染位置取**首个成员在原数组中的位置**，组内按 `k` 升序 —— 所以页面既有的
 * 「痛感分排序 / 自定义顺序」完全不受影响（本函数只做相邻合并，不改整体排序）。
 */

/** `<组名> <k>/<N>`，组名允许含空格（用非贪婪 + 末尾锚点兜住） */
const NAME_RE = /^(.+?)\s+(\d+)\s*\/\s*(\d+)$/;

/** 一个渲染单元：可能是单条，也可能是一组（`items.length > 1`） */
export interface ItemUnit {
  /** React key：组用 `group:<组名>`，单条用 `item.id` */
  key: string;
  /** 组名（已去掉 `k/N` 尾巴）；单条时为 `item.name` */
  label: string;
  /** 组成员，按 `k` 升序；单条时长度为 1 */
  items: Item[];
  /** 目标次数；单条恒为 1 */
  total: number;
  /** 是否真的是聚合卡（成员齐全且 `total > 1`） */
  grouped: boolean;
}

interface Parsed {
  prefix: string;
  k: number;
  n: number;
}

function parseName(item: Item): Parsed | null {
  const m = NAME_RE.exec(item.name);
  if (!m) return null;
  const k = Number(m[2]);
  const n = Number(m[3]);
  if (!Number.isInteger(k) || !Number.isInteger(n)) return null;
  if (n < 2 || k < 1 || k > n) return null;
  return { prefix: m[1].trim(), k, n };
}

/** 分堆的键：`cycle` + `path` + 组名 + `N` —— 四者全同才算"同一件事的若干次" */
const bucketKey = (it: Item, p: Parsed): string =>
  [it.cycle, it.path ?? '', p.prefix, p.n].join('\u0000');

/** 按"可能的分组键"归堆（聚合与"分组成员"两处共用同一套判定，避免两份会漂移的规则） */
function bucketize(items: readonly Item[]): Map<string, { parsed: Parsed; items: Item[] }> {
  const buckets = new Map<string, { parsed: Parsed; items: Item[] }>();
  for (const it of items) {
    const parsed = parseName(it);
    if (!parsed) continue;
    const key = bucketKey(it, parsed);
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(it);
    else buckets.set(key, { parsed, items: [it] });
  }
  return buckets;
}

/**
 * 一堆同键条目 → 按 `k` 升序的成员表；**不足以成组时返回 `null`**：
 *   - 只有一个成员 —— 没有"合并"可言；
 *   - 同一个 `k` 出现两次 —— 数据真矛盾，不猜哪条对，整堆退回单条。
 *
 * **不再要求"`k` 恰好凑齐 `1..N`"**（2026-09-24）：缺员是常态（成员被视图筛选或用户隐藏），
 * 详见文件头。组内顺序按 `k` 升序 —— 即使 `1/3` 被滤掉，剩下的也仍是"第 2 步 → 第 3 步"。
 */
function membersOf(bucket: { parsed: Parsed; items: Item[] }): Item[] | null {
  const byK = new Map<number, Item>();
  for (const m of bucket.items) {
    const p = parseName(m);
    if (!p || byK.has(p.k)) return null;
    byK.set(p.k, m);
  }
  if (byK.size < 2) return null;
  return [...byK.entries()].sort((a, b) => a[0] - b[0]).map(([, it]) => it);
}

/**
 * 把已排序的条目数组折成渲染单元数组。
 *
 * 输入必须是**页面即将渲染的那一份顺序**（本函数不排序，只做相邻合并），
 * 这样"排序规则"与"聚合规则"互不干扰。
 */
export function groupByCount(items: readonly Item[]): ItemUnit[] {
  const singles = (it: Item): ItemUnit => ({
    key: it.id,
    label: it.name,
    items: [it],
    total: 1,
    grouped: false,
  });

  const buckets = bucketize(items);
  /* 组的渲染位置取它**首个成员在原数组中的位置**（本函数不排序，只做相邻合并） */
  const firstIndex = new Map<string, number>();
  items.forEach((it, i) => {
    const parsed = parseName(it);
    if (!parsed) return;
    const key = bucketKey(it, parsed);
    if (!firstIndex.has(key)) firstIndex.set(key, i);
  });

  /* 判定成组：成员 ≥ 2 且 `k` 互不重复（**不再要求凑齐 `1..N`**，见文件头修订说明） */
  const groupOf = new Map<string, ItemUnit & { at: number }>();
  for (const [key, bucket] of buckets) {
    const members = membersOf(bucket);
    if (!members) continue;
    groupOf.set(key, {
      /* key 必须带上 cycle/path：组名相同但周期或入口不同的两堆是**两张不同的卡**
         （例如同名活动在每日与每周各有一组）。只用组名当 key 会让它们撞车 ——
         React 对这种重复 key 只给一条警告，表现是诡异的错渲染，极难查 */
      key: `group:${[bucket.parsed.prefix, members[0].cycle, members[0].path ?? ''].join('@')}`,
      label: bucket.parsed.prefix,
      items: members,
      /* 进度按**可见步数**算：某一步被用户手动隐藏时，宁可按 2 步做完，
         也不要按 3 步算却永远做不完（成员齐全时它就等于名字里的 N） */
      total: members.length,
      grouped: true,
      at: firstIndex.get(key) ?? 0,
    });
  }

  const out: ItemUnit[] = [];
  const emitted = new Set<string>();
  items.forEach((it, i) => {
    const parsed = parseName(it);
    const key = parsed ? bucketKey(it, parsed) : '';
    const group = key ? groupOf.get(key) : undefined;
    if (group) {
      if (emitted.has(key)) return;
      emitted.add(key);
      out.push(group);
      return;
    }
    /* 未成组（或压根不是 k/N 命名）→ 保持原位、单独渲染 */
    out.push(singles(it));
    void i;
  });

  return out;
}

/** 组内已完成条数（进度）。传进来的判定必须与页面所用的一致（`checked[id] !== undefined`） */
export function unitProgress(unit: ItemUnit, isDone: (id: string) => boolean): number {
  return unit.items.reduce((n, it) => (isDone(it.id) ? n + 1 : n), 0);
}

/**
 * 属于某个分组的**全部**条目 id —— 供列表编排把被视图筛选滤掉的分组成员捞回来。
 *
 * 为什么需要它：覆盖设置会触发「隐藏被覆盖项」、条目带 `days` 时在不适用的那天不显示
 * （勾选触发的「隐藏已完成」已于 2026-09-24 删除）—— 这些筛选一旦吃掉组里的一条，
 * **分组就被静默拆散**（用户看到的就是"怎么还是没合并"，且只有动过的那一组出问题）。
 * 判定分组该用**条目库**，不该用"当前列表里恰好剩下的项"：视图筛选只能决定
 * "这条自己显不显示"，不能决定"这个分组存不存在"。
 *
 * ⚠️ 调用方（`useChecklist`）传的必须是**条目库层**的数组：被用户在「条目管理」里
 * 手动隐藏的条目本来就不在里面，因此不会被复活 —— 那是用户的明确取舍。
 */
export function groupedMemberIds(items: readonly Item[]): Set<string> {
  const ids = new Set<string>();
  for (const bucket of bucketize(items).values()) {
    const members = membersOf(bucket);
    if (members) for (const m of members) ids.add(m.id);
  }
  return ids;
}

/**
 * **按"卡"切分待做 / 已完成** —— 列表页必须用这个，不要各自 `groupByCount(pending)`。
 *
 * ## 为什么不能分开算（2026-09-24 踩过一次，用户报"地域鬼王怎么没聚合"）
 *
 * 清单页的结构是「待做数组 + 已完成数组」两段渲染，所以很自然会写成
 * `groupByCount(pending)` 与 `groupByCount(done)`。**但这必然漏聚合**：
 * 只要用户勾掉 `1/3`，那一组就变成了 `pending = [2/3, 3/3]`、`done = [1/3]` ——
 * 两个数组各自都**凑不齐 `1..N`**，按"推不出来就不聚合"的规矩整堆退回单条，
 * 于是三次的地域鬼王散成三张卡。
 *
 * 正确做法是先**并起来**聚合，再按"整组是否全部完成"切回去：
 *
 *   - 全组完成 → 进 `done`（卡面显示满段 + 划除线）
 *   - **只要还有一步没完成 → 留在 `pending`**（卡面显示 `cur/total` 进度）
 *
 * 于是"做了一半"的组仍然是一张待做的卡（带着进度），而不是散开 ——
 * 这也是分段推进的题中之义。
 *
 * 组内成员的**相对顺序**与两段的顺序都保持：单元的落位取它第一个成员的位置，
 * 而 `pending` 在前（调用方传参顺序就是渲染顺序）。
 *
 * ⚠️ **与视图筛选的关系（2026-09-24 已修）**：覆盖隐藏 / 奖励类型 / 星期不适用
 * 原本会把不适用或已完成（那时还有一条勾了就触发的「隐藏已完成」，同日已删）的成员
 * **从数组里滤掉**，于是"做了一半的组"缺员 ——
 * 初版因此退回单条，这就是用户两次报的"地域鬼王怎么还是没有合并"
 * （而没动过的真·八岐大蛇 / 寮宴会正常，因为那一组没缺员）。
 * 现在两层一起兜住：`groupedMemberIds` + `useChecklist` 让**分组成员豁免视图筛选**
 * （成员一律进数组，再由 `pending/done` 归属决定它落在哪一段），聚合侧也不再要求
 * `k` 凑齐 `1..N`。用户**手动隐藏**的成员仍不复活（那是条目库层的取舍），
 * 此时按可见步数聚合与计进度 —— 见文件头的修订说明。
 */
export function groupChecklist(
  pending: readonly Item[],
  done: readonly Item[],
): { pending: ItemUnit[]; done: ItemUnit[] } {
  const doneIds = new Set(done.map((it) => it.id));
  const out: { pending: ItemUnit[]; done: ItemUnit[] } = { pending: [], done: [] };
  for (const unit of groupByCount([...pending, ...done])) {
    if (unit.items.every((it) => doneIds.has(it.id))) out.done.push(unit);
    else out.pending.push(unit);
  }
  return out;
}
