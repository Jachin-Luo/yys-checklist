import { useMemo } from 'react';
import type { Dungeon, Meta, SoulRow, SoulsDb, YuhunDb } from '../../api/types';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { dungeonDay, groupBySection, resolveFollow, WEEK_ORDER } from '../../domain/yuhun';

/**
 * 御魂副本（S6）—— **每个系列一张表**（2026-09-24 改版）。
 *
 * ## 这一页只回答一个问题：「哪天掉哪些御魂」
 *
 * 上一版是"每副本一张卡"：7 日条 + 模式徽章 + 解锁条件（`sub`）+ 当天结论段
 * + 二件套 chip 列表 + 攻略提示（`tip` / `dayTips`）。信息量不小，但**只有 7 日条在回答
 * 用户真正要问的那件事**，其余都在挤占它 —— 而 7 日条的格子里是一行 `join('·')` 且被
 * `truncate`，手机上本来就看不清（用户 2026-09-24 反馈）。所以这一版做减法：
 *
 *   - **行 = 副本、列 = 周一…周日、格 = 当天名单**（竖排，不截断）；
 *   - **今天整列高亮**（表头朱金底 + 列底淡金），一眼定位"今天掉什么"；
 *   - 一行一个系列，系列内所有副本横向摊平 —— 对比"这周刷哪个本"不必来回切。
 *
 * 删掉的东西：模式徽章、`sub`、`tip` / `dayTips` 文案、7 日条与"今日详情"的分离
 * （两者本是同一件事的两处渲染）、二件套 chip 列表。**数据一行未改** —— 全是渲染层取舍，
 * `domain/yuhun` 的派生函数照旧（`dungeonDay` / `groupBySection` / `resolveFollow`）。
 *
 * ## 三样东西必须留（删了表就是错的）
 *
 * 1. **跟随关系**：业原火（`followId`）当天还跟着八岐掉；永生之海（`followOld`）的**老魂**
 *    跟着魂十当天掉。不写这一行，它们的格子就是残缺的名单 —— 这是"掉什么"的一部分，不是注释。
 * 2. **特殊产出**（`reward`）：真·八岐大蛇**不产常规御魂**，产出是头像框 / 勾玉。没有它，
 *    这一行会是一排「—」，看起来像数据缺失。
 * 3. **二件套效果**：移进名字的 `title`（悬停可见），零版面成本 —— 上一版用 chip 常驻展示，
 *    一条首领御魂的被动能占掉两行。
 *
 * ## 底部速查表（2026-09-24 追加，用户要求）
 *
 * 正文只讲"哪天掉什么"，于是"某个御魂的两件套 / 四件套分别是什么、同类还有谁"缺一个
 * 反向入口 —— 底部这块就是它：**全部 70 条按两件套效果分类，每类各一张两列表**
 * （御魂名 | 四件套效果，常驻）。用真 `<table>`（`colgroup` + `table-fixed` 定死名字列宽），
 * 而不是列表 —— 列对齐才好扫读，换成"段标题 + 列表"就丢了表的感觉（用户当天反馈
 * "表格效果怎么没了"）；而**每类各自成卡 + 类间留白**，是因为 20 类挤在同一张表里时
 * 只靠一条浅线分隔，扫读会串到相邻分类去（紧接着的反馈："不同分类的中间隔开"）。
 *
 * 分段键 = **两件套效果原文**，不是类别：类别只是粗分，`暴击` 里同时住着「暴击 15%」与
 * 「暴击伤害 20%」（无刀取），按类别分段会把两个不同的两件套混成一堆（用户 2026-09-24
 * 明确要求拆开）。段序仍取 `dicts.soulCategory` 的 `sort`，同序保持数据顺序；
 * 全程**没有解析 `effect2` 的文本语义**，只是拿原文当键（铁律 7 禁的是"从自由文本反推
 * 语义"，不是"不许把原文当数据用"）。
 *
 * 唯一的例外是**首领御魂**（13 条）：按 `tools/build.js` 的规则它们本就没有四件套
 * （单件随机属性 + 两件套唯一被动），13 句 `effect2` 各不相同且都是长被动，拿哪一句都
 * 当不了段标题 → 合并为一段，标题用类别名「首领 · 无四件套」，段内逐条列各自的唯一被动。
 *
 * 四件套效果**常驻**（用户要求：超长换行即可，不截断）；首领回落显示两件套原文 ——
 * 那就是它的全部机制，不留空白。`note`（如"无任何副本产出"）仍在名字的 `title` 里。
 *
 * ## 手机宽度预算（`table-fixed`，不横滑）
 *
 * 375px 屏：外壳内缩 14×2 后约 347px，本节再 `px-3` 后约 323px。
 * 副本列定宽 74px，余下 249px 给 7 列 → 每列约 35px，正好放下 2–3 字的御魂名
 * （`text-2xs` = 10px）；4 字名（如「日女巳时」）换行成两行，仍可读。
 * **不用横向滚动**：表格在手机上横滑会让"一周对比"这件事失效（看不全就失去意义）。
 */
/** 星期短标签：优先取字典（`周一` → `一`），字典缺失时回落到常量 */
const DAY_FALLBACK = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayShort(meta: Meta | null): string[] {
  const idx = dictIndexOf(meta, 'weekday');
  if (!idx.size) return DAY_FALLBACK;
  const out = [...DAY_FALLBACK];
  for (const [code, v] of idx) out[Number(code)] = v.label.replace('周', '');
  return out;
}

/**
 * 副本名下方的小字：**跟随关系与特殊产出**（见文件头"三样东西必须留"）。
 * 两者都是"这个副本产出什么"的事实，不是评价 —— 所以留；评价类文案（`tip` / `randNote`）
 * 不在这里出现，`randNote` 降级为周末「随机」格的 `title`。
 */
function sideNote(d: Dungeon, dungeons: Dungeon[]): string | null {
  const follow = resolveFollow(d, dungeons);
  const parts: string[] = [];
  if (follow) {
    parts.push(`另跟随「${follow.name}」当天`);
  } else if (d.followOld) {
    const target = dungeons.find((x) => x.id === d.followOld);
    if (target) parts.push(`老魂跟随「${target.name}」当天`);
  }
  if (d.reward) parts.push(d.reward);
  return parts.length ? parts.join(' · ') : null;
}

export default function YuhunSection({
  yuhun,
  souls,
  variant,
}: {
  yuhun: YuhunDb;
  souls: SoulsDb;
  variant: 'mobile' | 'desktop';
}) {
  const meta = useItemStore((s) => s.meta);
  const dow = new Date().getDay();
  const week = useMemo(() => weekdayShort(meta), [meta]);
  const effectOf = useMemo(() => new Map(souls.rows.map((r) => [r.id, r.effect2])), [souls]);

  /* 分组顺序：字典 sort 优先，字典里没定义的 section 按数据出现顺序补在最后（不静默丢弃） */
  const groups = useMemo(() => {
    const raw = groupBySection(yuhun.dungeons);
    const dict = dictIndexOf(meta, 'yuhunSection');
    return [...raw].sort((a, b) => {
      const sa = dict.get(a.section)?.sort ?? 999;
      const sb = dict.get(b.section)?.sort ?? 999;
      return sa - sb;
    });
  }, [yuhun.dungeons, meta]);

  /**
   * 底部速查表：按**两件套效果**归类全部御魂（70 条）。
   *
   * 分类取数据里的 **结构化字段** `SoulRow.category`，组序与标签取 `dicts.soulCategory`
   * 的 `sort` / `label`（首领 → 攻击 → 生命 → 防御 → 暴击 → 效果抵抗 → 效果命中）。
   * **绝不解析 `effect2` 文本反推类别** —— 用正则从自由文本推断语义是本仓库明令禁止的
   * （AGENTS 铁律 7，历史教训：曾据此误判 87 条，已全部回滚）。字段缺定义者殿后，不静默丢弃。
   */
  const lookup = useMemo<Array<{ key: string; label: string; rows: SoulRow[] }>>(() => {
    const dict = dictIndexOf(meta, 'soulCategory');
    /* 无 `effect4` 的条目 = 首领御魂（`tools/build.js` 的规则：只有非首领才要求四件套，
       因为首领是"单件随机属性 + 两件套唯一被动"，**本来就没有四件套**）。它们的 `effect2`
       是 13 句各不相同的长被动，拿哪一句都当不了段标题 → 单独归一段。 */
    const boss: SoulRow[] = [];
    const byEffect = new Map<string, SoulRow[]>();
    for (const r of souls.rows) {
      if (!r.effect4) {
        boss.push(r);
        continue;
      }
      const list = byEffect.get(r.effect2);
      if (list) list.push(r);
      else byEffect.set(r.effect2, [r]);
    }

    const segs = [...byEffect.entries()].map(([effect, rows]) => ({
      key: effect,
      label: effect,
      rows,
    }));
    if (boss.length) {
      const cat = dict.get(boss[0].category)?.label ?? boss[0].category;
      segs.push({ key: `boss:${boss[0].category}`, label: `${cat} · 无四件套`, rows: boss });
    }

    /* 段序仍取 `dicts.soulCategory` 的 sort（同 sort 的段保持数据顺序，
       例如「暴击 15%」在「暴击伤害 20%」之前）。字典未定义的类别殿后，不静默丢弃。 */
    const rank = (s: { rows: SoulRow[] }) => dict.get(s.rows[0].category)?.sort ?? 999;
    return segs.sort((a, b) => rank(a) - rank(b));
  }, [souls, meta]);

  /* 桌面内容宽度到 896，字可以大一档、副本列也该宽些；手机保持 10px + 74px 才放得下 7 列 */
  const cellText = variant === 'desktop' ? 'text-xs' : 'text-2xs';
  const nameCol = variant === 'desktop' ? 'w-[168px]' : 'w-[74px]';

  return (
    <div className="pb-4">
      {groups.map(({ section, list }) => {
        const def = dictIndexOf(meta, 'yuhunSection').get(section);
        return (
          <section key={section} className={section === 'gogyo' ? 'opacity-80' : undefined}>
            <h2 className="px-3.5 pb-1 pt-3 font-serif text-sm tracking-group text-gold-hi">
              {def?.label ?? section}
            </h2>
            <div className="mx-3 overflow-hidden rounded-md border border-line-soft bg-surface">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-line-faint">
                    <th
                      scope="col"
                      className={`${nameCol} px-1.5 py-1.5 text-left font-normal text-ink-4 ${cellText}`}
                    >
                      副本
                    </th>
                    {WEEK_ORDER.map((x) => (
                      <th
                        key={x}
                        scope="col"
                        className={`px-0.5 py-1.5 text-center font-normal ${cellText} ${
                          x === dow ? 'bg-gold text-white' : 'text-ink-3'
                        }`}
                      >
                        {week[x]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const note = sideNote(d, yuhun.dungeons);
                    return (
                      <tr key={d.id} className="border-b border-line-faint align-top last:border-b-0">
                        <th scope="row" className="px-1.5 py-2 text-left align-top font-normal">
                          <span className={`block leading-snug text-ink ${cellText}`}>{d.name}</span>
                          {note ? (
                            <span className="mt-0.5 block text-2xs leading-snug text-ink-3">
                              {note}
                            </span>
                          ) : null}
                        </th>
                        {WEEK_ORDER.map((x) => {
                          const day = dungeonDay(d, x, yuhun.dayTips);
                          const today = x === dow;
                          return (
                            <td
                              key={x}
                              className={`px-0.5 py-2 text-center align-top ${
                                today ? 'bg-gold-soft/50' : ''
                              }`}
                            >
                              {day.random ? (
                                /* 周末随机池：名单官方未公布，只标「随机」；具体池子留在 `title` 里
                                   （页脚另有口径说明），不占版面 */
                                <span className={`${cellText} text-gold-hi`} title={d.randNote}>
                                  随机
                                </span>
                              ) : day.souls.length ? (
                                <span className="flex flex-col items-center gap-px">
                                  {day.souls.map((s) => (
                                    <span
                                      key={s}
                                      className={`leading-tight text-ink-2 ${cellText}`}
                                      title={effectOf.get(s)}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className={`${cellText} text-ink-4`}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* ── 底部速查：全部御魂按两件套效果归类 ── */}
      <section className="px-3 pt-5">
        <h2 className="px-0.5 pb-1 font-serif text-sm tracking-group text-gold-hi">
          御魂速查 · 按两件套效果
        </h2>
        {/* **一个分类一张表**（2026-09-24 用户要求：不同分类中间隔开、不要混在一起）。
            初版把 20 个分类塞进同一张表、段间只差一条浅线 —— 扫读时会串到相邻分类去。
            现在每段各自成卡（边框 + 圆角）＋ 段间 `space-y-2` 的留白，
            与上面"每个系列一张表"同一套视觉语言。 */}
        <div className="space-y-2">
          {lookup.map((seg) => (
            <div
              key={seg.key}
              className="overflow-hidden rounded-md border border-line-soft bg-surface"
            >
              {/* 两列表：**御魂名 | 四件套效果**。`table-fixed` + `colgroup` 定死名字列宽 ——
                  `table-fixed` 的列宽取自**首行**，而首行是跨两列的段标题，
                  不显式给宽度就会退化成两列等宽 */}
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className={nameCol} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    {/* `colSpan` 让段标题横跨两列，读起来是"这张表的分类" */}
                    <th
                      scope="colgroup"
                      colSpan={2}
                      className="bg-fill px-2.5 py-1.5 text-left font-normal"
                    >
                      <span className="text-sm text-ink">{seg.label}</span>
                      <span className="ml-2 text-2xs text-ink-4">{seg.rows.length} 种</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {seg.rows.map((r) => (
                    <tr key={r.id} className="border-t border-line-faint align-top">
                      <th
                        scope="row"
                        className="px-2.5 py-1.5 text-left align-top text-sm font-normal text-ink"
                      >
                        {r.name}
                      </th>
                      {/* 四件套效果**常驻**（2026-09-24 用户要求：超长换行即可，不截断）。
                          字号取正文口径 `text-sm`（12px）而不是 10px：首领那类原文 30–60 字，
                          10px 读起来吃力；页面会因此变长，这是"常驻"的代价。
                          首领御魂没有四件套（单件随机属性 + 两件套唯一被动），
                          这里回落显示它的两件套原文 —— 那就是它的全部机制，不留空白 */}
                      <td className="break-words px-2.5 py-1.5 text-sm leading-relaxed text-ink-3">
                        {r.effect4 ?? r.effect2}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* 口径只留一行（数据来源与排除名单必须留：本项目不用"看起来确定"糊过去） */}
      <p className="px-3.5 pb-2 pt-3 text-2xs leading-relaxed text-ink-3">
        名单以游戏内「副本说明」为准；八岐 1-10 与魂土周末随机掉常规御魂全集（排除：
        {yuhun.excluded.join('、')}）。
      </p>
    </div>
  );
}
