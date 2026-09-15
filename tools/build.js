#!/usr/bin/env node
/**
 * 数据校验 + 数据核对报告（设计文档 §4 字段规格 / §9 S1 · S1.5）
 *
 * 校验对象：`src/db/*.db.json`（应用真正读的种子）
 * 双重校验：枚举 code 与 `src/domain/enums.ts` 的**字面量联合类型**双向对齐（§4.0 双轨制）
 *
 * 用法：npm run db:check   （等价 node tools/build.js）
 * 退出码：有 error 即 1（CI / 迁移后复核用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ---------- 0. 从 domain/enums.ts 抠出枚举（双轨制的一半） ---------- */
const enumsSrc = fs.readFileSync(path.join(ROOT, 'src/domain/enums.ts'), 'utf8');
function extractEnum(name) {
  const re = new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`);
  const m = re.exec(enumsSrc);
  if (!m) throw new Error(`无法从 src/domain/enums.ts 解析 ${name}`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}
const CYCLE = extractEnum('CYCLE');
const GAIN_KIND = extractEnum('GAIN_KIND');
const SORT_BY = extractEnum('SORT_BY');
const DICT_TYPE = extractEnum('DICT_TYPE');
const ORIGIN = ['preset', 'custom'];

/* ---------- 1. 读库 ---------- */
const metaDb = readJson('src/db/meta.db.json');
const itemsDb = readJson('src/db/items.db.json');
const limitedDb = readJson('src/db/limited.db.json');
const yuhunDb = readJson('src/db/yuhun.db.json');
const bountyDb = readJson('src/db/bounty.db.json');
const soulsDb = readJson('src/db/souls.db.json');
const usersDb = readJson('src/db/users.db.json');
const versionDb = readJson('src/db/dataVersion.db.json');

const dictCodes = (type) => new Set(metaDb.dicts.filter((d) => d.type === type).map((d) => d.code));
const NOW = Date.now();
const ts = (s) => {
  if (!s) return null;
  const raw = String(s).trim();
  const iso = raw.length === 10 ? `${raw}T23:59:59` : `${raw.replace(' ', 'T')}:00`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};
/** 官方未公布截止日、但已在 note 里显式标注"待定"的条目：属已知的未知，不算漏标 */
const isExplicitlyPending = (it) => /未公布|待定|以游戏内为准|待核/.test(it.note || '');

/* ---------- 2. dicts 表 + 双轨校验 ---------- */
const dictSeen = new Set();
const dictTypes = new Set();
for (const d of metaDb.dicts) {
  const tag = `[dicts/${d.type}/${d.code}]`;
  if (!DICT_TYPE.includes(d.type)) err(`${tag} type 不在 DICT_TYPE 中`);
  dictTypes.add(d.type);
  if (dictSeen.has(`${d.type}|${d.code}`)) err(`${tag} 联合主键重复`);
  dictSeen.add(`${d.type}|${d.code}`);
  if (!d.label) err(`${tag} 缺 label`);
  if (typeof d.sort !== 'number') err(`${tag} sort 应为数字`);
}
const PAIRS = [['cycle', CYCLE], ['gainKind', GAIN_KIND]];
for (const [type, codes] of PAIRS) {
  const inJson = dictCodes(type);
  for (const c of codes) if (!inJson.has(c)) err(`[双轨] enums.ts 声明了 ${type}=${c}，但 dicts 表缺 label`);
  for (const c of inJson) if (!codes.includes(c)) err(`[双轨] dicts 表有 ${type}=${c}，但 enums.ts 未声明`);
}

/* ---------- 3. items ---------- */
/* `reward` / `entry` / `action` 于 2026-09-11 从数据模型删除，因此从白名单移除 ——
   旧数据若残留这些字段会被这条白名单拦下（`未知/已废字段`），这正是想要的效果 */
const ALLOWED = new Set(['id', 'name', 'cycle', 'days', 'path',
  'gainKind', 'gain', 'gainNote', 'condition', 'time', 'timeEnd', 'timeNote', 'isGuildTime',
  'start', 'deadline', 'until', 'since', 'autoDaily', 'isAutoHub', 'premium', 'note', 'origin']);
/* 条目双文件（2026-09-11；2026-09-15 收紧常驻口径）：items = 真正的常驻（每日/每周/每月），
   limited = 非常驻（活动期每日 / 限时 / 版本 / 赛季；带 until 的到期即删）。
   校验一律作用在**合并集**上 —— id 查重 / isAutoHub 全局恰 1 / 字典约束都跨文件生效 */
const items = [...itemsDb.items, ...limitedDb.items];
const fileOf = new Map([
  ...itemsDb.items.map((x) => [x.id, 'items']),
  ...limitedDb.items.map((x) => [x.id, 'limited']),
]);
const itemIds = new Set();
let hubCount = 0;
for (const it of items) {
  const tag = `[${fileOf.get(it.id)}/${it.id || '?'}]`;
  for (const k of Object.keys(it)) {
    if (!ALLOWED.has(k)) err(`${tag} 未知/已废字段: ${k}`);
  }
  for (const k of ['id', 'name', 'cycle', 'origin']) {
    if (!(k in it)) err(`${tag} 缺必填字段 ${k}`);
  }
  if (!/^[a-z0-9_]+$/.test(it.id || '')) err(`${tag} id 格式非法`);
  if (itemIds.has(it.id)) err(`${tag} id 重复`);
  itemIds.add(it.id);
  if ((it.name || '').length < 2 || (it.name || '').length > 24) err(`${tag} name 长度应为 2–24`);
  if (!CYCLE.includes(it.cycle)) err(`${tag} cycle 非法: ${it.cycle}`);
  if (!ORIGIN.includes(it.origin)) err(`${tag} origin 非法: ${it.origin}`);
  if (it.days) {
    if (!Array.isArray(it.days) || it.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      err(`${tag} days 应为 0–6 的整数数组`);
    } else if (new Set(it.days).size !== it.days.length) err(`${tag} days 有重复`);
  }
  if (it.gainKind) {
    if (!Array.isArray(it.gainKind)) err(`${tag} gainKind 应为数组`);
    else {
      if (new Set(it.gainKind).size !== it.gainKind.length) err(`${tag} gainKind 有重复`);
      if (it.gainKind.length > 8) err(`${tag} gainKind 超过 8 项`);
      it.gainKind.forEach((k) => { if (!GAIN_KIND.includes(k)) err(`${tag} gainKind 非法: ${k}`); });
    }
  }
  if (it.gain) {
    const keys = Object.keys(it.gain);
    for (const k of keys) {
      if (!['jade', 'blackFrag', 'blueTicket'].includes(k)) err(`${tag} gain.${k} 未知币种`);
      else if (typeof it.gain[k] !== 'number' || it.gain[k] < 0) err(`${tag} gain.${k} 应为非负数`);
    }
    if (!keys.some((k) => it.gain[k] > 0)) err(`${tag} gain 三项全为 0，等于没标固定收益`);
    const EQUIV = { jade: ['jade'], blackFrag: ['blackFrag', 'blackDaruma'], blueTicket: ['blueTicket'] };
    for (const [gk, alts] of Object.entries(EQUIV)) {
      if (it.gain[gk] > 0 && !(it.gainKind || []).some((k) => alts.includes(k))) {
        err(`${tag} gain.${gk}>0 但 gainKind 未标注（需 ${alts.join('/')}）`);
      }
    }
  }
  if (it.time && !/^\d{2}:\d{2}$/.test(it.time)) err(`${tag} time 格式应为 HH:mm`);
  if (it.timeEnd && !/^\d{2}:\d{2}$/.test(it.timeEnd)) err(`${tag} timeEnd 格式应为 HH:mm`);
  if (it.time && it.timeEnd && it.time >= it.timeEnd) err(`${tag} timeEnd 应晚于 time`);
  for (const k of ['start', 'deadline']) {
    if (it[k] && !/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(it[k])) err(`${tag} ${k} 格式非法`);
  }
  for (const k of ['since', 'until']) {
    if (it[k] && !/^\d{4}-\d{2}-\d{2}$/.test(it[k])) err(`${tag} ${k} 格式应为 YYYY-MM-DD`);
  }
  if (it.start && it.deadline && it.deadline < it.start) err(`${tag} deadline 早于 start`);
  if (it.since && it.until && it.since > it.until) err(`${tag} since 晚于 until`);
  if (it.isAutoHub) hubCount++;
  if (it.isGuildTime && !it.time) warn(`${tag} 标了寮自定时间但没填 time，UI 无法提示"还没到点"`);
  /* 缺 until 的限时项：若已显式标注"官方未公布"，属**已知的未知**，不算漏标（S1.5 ③） */
  if (it.cycle === 'limited' && !it.deadline && !it.until && !isExplicitlyPending(it)) {
    warn(`${tag} 限时项既无 deadline 也无 until，且 note 未标注"未公布/待定"，无法判断何时归档`);
  }
  if (it.until && ts(it.until) < NOW) warn(`${tag} until=${it.until} 已过期，应从清单归档`);
  if (it.deadline && ts(it.deadline) < NOW) warn(`${tag} deadline=${it.deadline} 已过，活动已结束`);
}
if (hubCount !== 1) err(`isAutoHub 条目应恰好 1 条，当前 ${hubCount} 条`);

/* ---------- 4. periods（S1 要求：缺锚点改 error） ---------- */
const periods = metaDb.meta.periods || {};
for (const c of ['version', 'season']) {
  const list = items.filter((it) => it.cycle === c);
  if (!list.length) continue;
  const anchor = periods[c];
  if (!anchor || !anchor.startAt) {
    err(`[meta.periods] 有 ${list.length} 条 ${c} 周期条目，但未填 periods.${c}.startAt —— 这些条目的勾选状态会误套每日 05:00 重置`);
  } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(anchor.startAt)) {
    err(`[meta.periods.${c}] startAt 格式应为 YYYY-MM-DDTHH:mm`);
  }
}
if (metaDb.meta.version !== '1.4.0') warn(`[meta] version=${metaDb.meta.version}，设计文档口径为 1.4.0`);

/* ---------- 5. viewDefaults / sortOptions ---------- */
const vd = metaDb.viewDefaults;
if (!SORT_BY.includes(vd.sortBy)) err(`[viewDefaults] sortBy=${vd.sortBy} 不在 sortOptions 中`);
if (!Array.isArray(vd.showKinds)) err('[viewDefaults] showKinds 应为数组');
else vd.showKinds.forEach((k) => { if (!GAIN_KIND.includes(k)) err(`[viewDefaults] showKinds 含非法类型 ${k}`); });
if (typeof vd.minWeight !== 'number' || vd.minWeight < 0) err('[viewDefaults] minWeight 应为非负数');
if (!Array.isArray(vd.pinned)) err('[viewDefaults] pinned 应为数组');
else vd.pinned.forEach((id) => { if (!itemIds.has(id)) err(`[viewDefaults] pinned 的 id 不存在: ${id}`); });
const sortIds = metaDb.sortOptions.map((s) => s.id);
for (const id of SORT_BY) if (!sortIds.includes(id)) err(`[sortOptions] 缺 ${id}`);
for (const id of sortIds) if (!SORT_BY.includes(id)) err(`[sortOptions] 多出未定义项 ${id}`);

/* ---------- 6. yuhun ---------- */
const MODES = ['weekly', 'follow', 'fixed', 'special'];
const soulIds = new Set(soulsDb.rows.map((r) => r.id));
const dungeonIds = new Set();
const sectionCodes = dictCodes('yuhunSection');
for (const d of yuhunDb.dungeons) {
  const tag = `[dungeons/${d.id}]`;
  if (dungeonIds.has(d.id)) err(`${tag} id 重复`);
  dungeonIds.add(d.id);
  if (!MODES.includes(d.mode)) err(`${tag} mode 非法: ${d.mode}`);
  if (!sectionCodes.has(d.section)) err(`${tag} section 未在 dicts.yuhunSection 定义: ${d.section}`);
  if (!Array.isArray(d.drops)) err(`${tag} drops 应为数组（可为空）`);
  else for (const r of d.drops) {
    if (!soulIds.has(r.soulId)) err(`${tag} drops.soulId 不存在于 souls: ${r.soulId}`);
    if (r.dow !== undefined && !(Number.isInteger(r.dow) && r.dow >= 0 && r.dow <= 6)) err(`${tag} drops.dow 应为 0–6`);
  }
}
for (const d of yuhunDb.dungeons) {
  if (d.followId && !dungeonIds.has(d.followId)) err(`[dungeons/${d.id}] followId 不存在: ${d.followId}`);
  if (d.followOld && !dungeonIds.has(d.followOld)) err(`[dungeons/${d.id}] followOld 不存在: ${d.followOld}`);
  if (d.mode === 'weekly') {
    const dows = new Set(d.drops.map((r) => r.dow));
    for (let i = 1; i <= 5; i++) if (!dows.has(i)) err(`[dungeons/${d.id}] mode=weekly 缺少星期 ${i} 的掉落`);
  } else if (d.mode !== 'special' && !d.drops.length) err(`[dungeons/${d.id}] 未配置任何掉落`);
}
for (const t of yuhunDb.dayTips) {
  if (!dungeonIds.has(t.dungeonId)) err(`[dayTips] dungeonId 不存在: ${t.dungeonId}`);
}
if (!Array.isArray(yuhunDb.excluded)) err('[yuhun] excluded 应为字符串数组');

/* ---------- 7. bounty ---------- */
const shikiIds = new Set(bountyDb.shikigami.map((s) => s.id));
const spotIds = new Set(bountyDb.spots.map((s) => s.id));
const spotKindCodes = dictCodes('spotKind');
for (const s of bountyDb.spots) {
  if (!spotKindCodes.has(s.kind)) err(`[spots/${s.id}] kind 未在 dicts.spotKind 定义: ${s.kind}`);
}
const spotHit = new Set();
for (const r of bountyDb.shikigamiSpots) {
  if (!shikiIds.has(r.shikigamiId)) err(`[shikigamiSpots] 式神不存在: ${r.shikigamiId}`);
  if (!spotIds.has(r.spotId)) err(`[shikigamiSpots] 出处不存在: ${r.spotId}`);
  if (!(r.count > 0)) err(`[shikigamiSpots] ${r.shikigamiId}@${r.spotId} count 应为正数`);
  spotHit.add(r.spotId);
}
for (const r of bountyDb.shikigamiClues) {
  if (!shikiIds.has(r.shikigamiId)) err(`[shikigamiClues] 式神不存在: ${r.shikigamiId}`);
  if (!r.word) err(`[shikigamiClues] ${r.shikigamiId} 线索为空`);
}
for (const id of shikiIds) {
  if (!bountyDb.shikigamiSpots.some((r) => r.shikigamiId === id)) err(`[shikigami] ${id} 没有任何出处`);
}
for (const id of spotIds) if (!spotHit.has(id)) warn(`[spots] ${id} 没有关联任何式神`);

/* ---------- 8. souls ---------- */
const soulSeen = new Set();
const catCodes = dictCodes('soulCategory');
for (const r of soulsDb.rows) {
  if (soulSeen.has(r.id)) err(`[souls/${r.id}] id 重复`);
  soulSeen.add(r.id);
  if (!r.effect2) warn(`[souls/${r.id}] 缺少两件套效果`);
  /* 四件套：首领御魂机制特殊（单件给随机属性 + 两件套触发唯一被动），**本来就没有四件套** → 豁免；
     其余品类缺 effect4 视为未填，报 warning 而不是 error（与 effect2 同口径：先让数据进来再收敛） */
  if (!r.effect4 && r.category !== '首领') warn(`[souls/${r.id}] 缺少四件套效果`);
  if (!catCodes.has(r.category)) err(`[souls/${r.id}] category 未在 dicts.soulCategory 定义: ${r.category}`);
}

/* ---------- 9. users ---------- */
const userIds = new Set(usersDb.users.map((u) => u.id));
const profileIds = new Set(usersDb.profiles.map((p) => p.id));
if (!usersDb.users.length) err('[users] users 表为空');
for (const p of usersDb.profiles) {
  if (!userIds.has(p.userId)) err(`[profiles/${p.id}] userId 不存在: ${p.userId}`);
}
const defaults = usersDb.profiles.filter((p) => p.isDefault);
if (defaults.length > 1) err(`[profiles] isDefault 只能有 1 个，当前 ${defaults.length} 个`);
for (const [table, rows] of [['states', usersDb.states], ['viewPrefs', usersDb.viewPrefs], ['itemOverrides', usersDb.itemOverrides]]) {
  for (const r of rows) {
    if (!profileIds.has(r.profileId)) err(`[${table}] profileId 不存在: ${r.profileId}`);
  }
}
const COVER_MODES = ['dim', 'hide'];
for (const v of usersDb.viewPrefs) {
  (v.showKinds || []).forEach((k) => { if (!GAIN_KIND.includes(k)) err(`[viewPrefs/${v.profileId}] showKinds 非法类型 ${k}`); });
  if (v.coverMode !== undefined && !COVER_MODES.includes(v.coverMode)) {
    err(`[viewPrefs/${v.profileId}] coverMode 非法: ${v.coverMode}（只能是 ${COVER_MODES.join('|')}）`);
  }
  /* 一键日常覆盖集合：可选字段；未配置（undefined）表示「跟随数据默认」，不校验存在性 */
  if (v.autoSet !== undefined) {
    if (!Array.isArray(v.autoSet)) err(`[viewPrefs/${v.profileId}] autoSet 应为字符串数组`);
    else {
      if (new Set(v.autoSet).size !== v.autoSet.length) err(`[viewPrefs/${v.profileId}] autoSet 有重复项`);
      v.autoSet.forEach((id) => {
        if (!itemIds.has(id)) err(`[viewPrefs/${v.profileId}] autoSet 含不存在的条目 id: ${id}`);
      });
    }
  }
}
for (const s of usersDb.sessions) {
  if (!userIds.has(s.userId)) err(`[sessions] userId 不存在: ${s.userId}`);
  if (!profileIds.has(s.profileId)) err(`[sessions] profileId 不存在: ${s.profileId}`);
}

/* ---------- 10. dataVersion ---------- */
if (!versionDb.versions.length) err('[dataVersion] versions 表为空');
for (const v of versionDb.versions) {
  if (!v.db || !v.version || !v.updated) err(`[versions] ${JSON.stringify(v)} 缺 db/version/updated`);
}

/* ---------- 11. 数据核对报告（S1.5 ②） ---------- */
const gainItems = items.filter((i) => i.gain);
const sum = (k) => gainItems.reduce((s, i) => s + (i.gain[k] || 0), 0);
const calib = items.filter((i) => i.gainNote && /待校准/.test(i.gainNote));
const noUntilUnmarked = items.filter((i) => i.cycle === 'limited' && !i.until && !isExplicitlyPending(i));
const noUntilPending = items.filter((i) => i.cycle === 'limited' && !i.until && isExplicitlyPending(i));
const timeWindow = items.filter((i) => i.time);
const pendingReview = items.filter((i) => /待核|待校准|以游戏内为准|未正式|未官方/.test(`${i.note || ''}${i.gainNote || ''}`));
const byCycle = {};
items.forEach((i) => { byCycle[i.cycle] = (byCycle[i.cycle] || 0) + 1; });
const kindDist = {};
items.forEach((i) => (i.gainKind || []).forEach((k) => { kindDist[k] = (kindDist[k] || 0) + 1; }));

const report = [
  `# 数据核对报告（自动生成）`,
  ``,
  `> 生成命令：\`npm run db:check\` · 数据版本 ${metaDb.meta.dataVersion} · 更新日 ${metaDb.meta.updated}`,
  ``,
  `## 总览`,
  ``,
  `| 项 | 值 |`,
  `|---|---|`,
  `| 条目总数 | ${items.length} |`,
  `| 周期分布 | ${Object.entries(byCycle).map(([k, v]) => `${k} ${v}`).join(' · ')} |`,
  `| 固定收益条目 | ${gainItems.length}（勾玉 ${sum('jade')} / 黑碎 ${sum('blackFrag')} / 蓝票 ${sum('blueTicket')}） |`,
  `| 标「待校准」 | ${calib.length}${calib.length ? ` —— ${calib.map((i) => i.id).join('、')}` : ''} |`,
  `| 限时项缺 until（漏标） | ${noUntilUnmarked.length}${noUntilUnmarked.length ? ` —— ${noUntilUnmarked.map((i) => i.id).join('、')}` : ''} |`,
  `| 限时项缺 until（已标注待定） | ${noUntilPending.length}${noUntilPending.length ? ` —— ${noUntilPending.map((i) => i.id).join('、')}` : ''} |`,
  `| 带时间窗条目 | ${timeWindow.length}（来源：NGA 整理 + 官方公告，待全面核对） |`,
  `| 版本/赛季锚点 | ${Object.entries(periods).map(([k, v]) => `${k}=${v.key || '?'}@${v.startAt || '?'}`).join(' · ') || '未填'} |`,
  ``,
  `## 人工待核清单（S1.5 ①）`,
  ``,
  pendingReview.length
    ? pendingReview.map((i) => `- \`${i.id}\` ${i.name} —— ${i.gainNote || i.note || ''}`).join('\n')
    : '- 无',
  ``,
  `## 奖励类型分布`,
  ``,
  Object.entries(kindDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k} ${v}`).join('\n'),
  ``,
].join('\n');
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/data-check.md'), report, 'utf8');

/* ---------- 12. 输出 ---------- */
if (errors.length) {
  console.error(`\n校验失败：${errors.length} 个错误\n`);
  errors.forEach((e) => console.error('  ' + e));
  if (warnings.length) {
    console.log(`\n另有 ${warnings.length} 个警告：`);
    warnings.forEach((w) => console.log('  ' + w));
  }
  process.exit(1);
}
console.log(`校验通过：${items.length} 条条目 · ${metaDb.dicts.length} 行字典 · 0 错误`);
console.log(`  周期分布 ${JSON.stringify(byCycle)}`);
console.log(`  固定收益 ${gainItems.length} 条（勾玉 ${sum('jade')} / 黑碎 ${sum('blackFrag')} / 蓝票 ${sum('blueTicket')}）`);
console.log(`  关系表 souls ${soulsDb.rows.length} · dungeons ${yuhunDb.dungeons.length} · drops ${yuhunDb.dungeons.reduce((s, d) => s + d.drops.length, 0)}`
  + ` · shikigami ${bountyDb.shikigami.length} · spots ${bountyDb.spots.length} · 关联 ${bountyDb.shikigamiSpots.length}/${bountyDb.shikigamiClues.length}`);
console.log(`  带时间窗 ${timeWindow.length} 条 · 已拆条 2 处 · 含 until ${items.filter((i) => i.until).length} 条`);
console.log(`  已生成 reports/data-check.md`);
if (warnings.length) {
  console.log(`\n${warnings.length} 个警告（不阻塞）：`);
  warnings.forEach((w) => console.log('  ' + w));
}
