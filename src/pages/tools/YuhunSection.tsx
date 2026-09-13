import { useMemo, type ReactNode } from 'react';
import type { DayTip, Dungeon, DungeonMode, Meta, SoulsDb, YuhunDb } from '../../api/types';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { dungeonDay, groupBySection, hasDayGrid, MODE_LABEL, oldFollowInfo, resolveFollow, WEEK_ORDER } from '../../domain/yuhun';

/**
 * 御魂副本（S6）。
 *
 * 三件事决定了这一页的信息架构：
 *   1. **今天周几**是核心变量 —— 轮换本"今天掉什么"每天不同，错了就白刷一天
 *   2. **7 日条**把所有天的名单一次铺开：不用来回切日期就能判断"这周值不值得刷"
 *   3. 卡片要标出**二件套效果**（`souls` 字典 join），否则用户看到"片叶之苇"还得另外去查
 *
 * 分组顺序取自 `dicts.type='yuhunSection'`（八岐系 → 永生之海 → 日轮 → 其他 → 业原火），
 * 不写死在组件里 —— 调整分组只需改数据。
 */

const MODE_TONE: Record<DungeonMode, string> = {
  weekly: 'bg-brand-soft text-brand',
  follow: 'bg-brand-soft text-brand',
  fixed: 'bg-surface-3 text-ink-2',
  special: 'bg-warn-soft text-warn',
};

const DAY_FALLBACK = ['日', '一', '二', '三', '四', '五', '六'];

/** 星期短标签：优先取字典（`周一` → `一`），字典缺失时回落到常量 */
function weekdayShort(meta: Meta | null): string[] {
  const idx = dictIndexOf(meta, 'weekday');
  if (!idx.size) return DAY_FALLBACK;
  const out = [...DAY_FALLBACK];
  for (const [code, v] of idx) out[Number(code)] = v.label.replace('周', '');
  return out;
}

/**
 * 二件套效果 chip。
 *
 * **效果文本长度差异极大**：常规御魂是一句短效果（"攻击加成 15%"），
 * 而**首领御魂的两件套本身就是一段长被动**（土蜘蛛那条 60 余字 —— 2026-09-11 导入原文以前，
 * 这里填的是占位串「首领 · 对怪生效」）。所以必须按**可变长**处理：
 * chip 限宽 + 效果截断 + 全文进 `title`，否则一个 chip 就能撑满整行、把"今天掉什么"挤没。
 * 效果未核实时显式标「待核」，不假装知道。
 */
function SoulChip({ id, effect }: { id: string; effect?: string }) {
  const pending = !effect || effect.includes('待核');
  return (
    <span
      className="inline-flex max-w-full items-baseline gap-1 rounded-sm bg-surface-3 px-1.5 py-0.5 text-sm text-ink"
      title={pending ? undefined : effect}
    >
      <span className="flex-none">{id}</span>
      <i className={`min-w-0 truncate not-italic text-xs ${pending ? 'text-warn' : 'text-ink-3'}`}>
        {pending ? '待核' : effect}
      </i>
    </span>
  );
}

function SoulChips({ souls, effectOf }: { souls: string[]; effectOf: Map<string, string> }) {
  if (!souls.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {souls.map((s) => (
        <SoulChip key={s} id={s} effect={effectOf.get(s)} />
      ))}
    </div>
  );
}

function DungeonCard({
  d,
  dungeons,
  tips,
  effectOf,
  dow,
  week,
}: {
  d: Dungeon;
  dungeons: Dungeon[];
  tips: DayTip[];
  effectOf: Map<string, string>;
  dow: number;
  week: string[];
}) {
  const day = dungeonDay(d, dow, tips);
  const following = resolveFollow(d, dungeons);
  const old = oldFollowInfo(d, dungeons, tips, dow);
  const grid = hasDayGrid(d);

  /* 当天结论 —— 顺序不能换：特殊产出 > 随机池 > 套装跟随 > 当日轮换 > 常驻 > 无掉落 */
  let today: ReactNode = null;
  if (d.mode === 'special') {
    today = (
      <div className="mt-1.5 rounded-sm bg-warn-soft px-2 py-1.5 text-sm leading-relaxed text-warn">
        {d.reward ?? '特殊产出'}
      </div>
    );
  } else if (day.random) {
    today = (
      <div className="mt-1.5 rounded-sm bg-brand-soft px-2 py-1.5 text-sm text-brand">
        {d.randNote ?? '周末随机掉落 · 排除专属与首领御魂'}
      </div>
    );
  } else if (following && day.souls.length) {
    today = (
      <>
        <p className="mt-1.5 text-sm text-ink-2">专属掉落 · 另跟随「{following.name}」当天</p>
        <SoulChips souls={day.souls} effectOf={effectOf} />
      </>
    );
  } else if (grid && day.souls.length) {
    today = (
      <>
        <p className="mt-1.5 text-sm text-ink-2">今天周{week[dow]}掉落</p>
        <SoulChips souls={day.souls} effectOf={effectOf} />
      </>
    );
  } else if (!grid && day.souls.length) {
    today = (
      <>
        <p className="mt-1.5 text-sm text-ink-2">固定掉落 · 不挑日子</p>
        <SoulChips souls={day.souls} effectOf={effectOf} />
      </>
    );
  } else {
    today = <p className="mt-1.5 text-sm text-ink-3">今天没有掉落</p>;
  }

  return (
    <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <h3 className="flex-1 text-lg font-medium text-ink">{d.name}</h3>
        <span className={`flex-none rounded-sm px-1.5 py-0.5 text-xs ${MODE_TONE[d.mode]}`}>
          {MODE_LABEL[d.mode]}
        </span>
      </div>
      {d.sub ? <p className="mt-0.5 text-sm text-ink-3">{d.sub}</p> : null}

      {grid ? (
        <div className="mt-2 grid grid-cols-7 gap-0.5">
          {WEEK_ORDER.map((x) => {
            const cell = dungeonDay(d, x, tips);
            const text = cell.random
              ? '随机'
              : cell.souls.length >= 4
                ? `${cell.souls.length} 种全出`
                : cell.souls.join('·') || '—';
            const on = x === dow;
            return (
              <span
                key={x}
                className={`flex flex-col items-center rounded-sm px-0.5 py-1 ${on ? 'bg-brand' : 'bg-surface-3'}`}
              >
                <b className={`text-xs font-medium ${on ? 'text-white' : 'text-ink-2'}`}>{week[x]}</b>
                <i
                  className={`mt-0.5 block w-full truncate text-center text-xs not-italic ${on ? 'text-brand-soft' : 'text-ink-3'}`}
                >
                  {text}
                </i>
              </span>
            );
          })}
        </div>
      ) : null}

      {today}

      {old ? (
        <div className="mt-1.5 border-t border-line-faint pt-1.5 text-sm text-ink-2">
          老魂跟随「{old.name}」今天：
          {old.random ? (
            <b className="text-warn">魂十全池随机</b>
          ) : (
            <span className="text-ink">{old.souls.join('、')}</span>
          )}
        </div>
      ) : null}

      {day.tip ? <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{day.tip}</p> : null}
    </div>
  );
}

export default function YuhunSection({ yuhun, souls, variant }: { yuhun: YuhunDb; souls: SoulsDb; variant: 'mobile' | 'desktop' }) {
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

  const rotating = yuhun.dungeons.filter((d) => hasDayGrid(d)).length;
  const cardClass = variant === 'desktop' ? 'grid grid-cols-1 gap-2 xl:grid-cols-2' : 'space-y-2';

  return (
    <div>
      <div className="mx-3 mt-3 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-2">
        <b className="text-ink">{yuhun.dungeons.length} 个御魂副本</b>按来源归成 {groups.length} 组，
        其中 <b className="text-ink">{rotating} 个按星期轮换</b>。轮换本的 7 日条已把每天掉什么铺开，
        <b className="text-ink">今天周{week[dow]}已高亮</b>。
      </div>

      {groups.map(({ section, list }) => {
        const def = dictIndexOf(meta, 'yuhunSection').get(section);
        return (
          <section key={section} className={section === 'gogyo' ? 'opacity-80' : undefined}>
            <div className="flex items-baseline gap-2 px-3.5 pb-1 pt-3">
              <b className="text-lg font-medium text-ink">{def?.label ?? section}</b>
              {def?.note ? <span className="text-sm text-ink-3">{def.note}</span> : null}
            </div>
            <div className={`px-3 ${cardClass}`}>
              {list.map((d) => (
                <DungeonCard key={d.id} d={d} dungeons={yuhun.dungeons} tips={yuhun.dayTips} effectOf={effectOf} dow={dow} week={week} />
              ))}
            </div>
          </section>
        );
      })}

      {/* 页脚口径（2026-09-11 按 `reports/御魂掉落总表_2026-09-11.md` 更新）：
          ① 排除名单改为**全量列出**（原 `slice(0, 8)` + "等"，而名单正好 8 项，"等"字会让人以为还有）；
          ② 删掉"魂 13·虚无轮换表官方未公布、标待核" —— 该轮换表已按灰机结构化数据填入，再写就不实了；
          ③ 补上报表自己标了 ⚠️ 的那条存疑（魂土专属是否算进 1-10 周末池），不假装确定。 */}
      <p className="px-3.5 pb-6 pt-4 text-sm leading-relaxed text-ink-3">
        八岐 1-10 与魂土周末随机掉常规御魂全集（排除：{yuhun.excluded.join('、')}）；
        魂王周末 = 火之车 + 新御魂随机，魂 13·虚无周末 = 夜啼石 + 新御魂随机。
        魂土专属是否纳入 1-10 周末池，各源口径不一，以游戏内「副本说明」为准。
      </p>
    </div>
  );
}
