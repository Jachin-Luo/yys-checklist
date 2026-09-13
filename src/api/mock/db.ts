/**
 * 种子读取 —— **唯一允许 import 数据库 JSON 的地方**（设计文档 §2 铁律）。
 *
 * 该限制由 ESLint `no-restricted-imports` 强制（见 eslint.config.js），违反即报错。
 * 这是整套设计能不能活到接后端那天的唯一保障：业务代码若散落 `import items`，
 * 后期接后端要改几十个文件，且分不清哪些是主数据、哪些是用户数据。
 *
 * 加载策略（§3.3）：
 *   - `meta` / `items`：静态 import，进主包（首屏必用，合计 < 80 KB）
 *   - `yuhun` / `bounty` / `souls`：动态 `import()` 懒加载，只有进「工具」页才拉（约 180 KB）
 */
import metaDbRaw from '../../db/meta.db.json';
import itemsDbRaw from '../../db/items.db.json';
import limitedDbRaw from '../../db/limited.db.json';
import usersDbRaw from '../../db/users.db.json';
import dataVersionDbRaw from '../../db/dataVersion.db.json';
import type {
  BountyDb,
  Item,
  MetaDbFile,
  SoulsDb,
  UsersDbFile,
  VersionRow,
  YuhunDb,
} from '../types';

/** 系统库：meta 表 + dicts + sortOptions + viewDefaults */
export const seedMetaDb = metaDbRaw as unknown as MetaDbFile;

/** 条目库（2026-09-11 拆双文件）：`items.db.json` = **常驻模板**（长期有效、变动少）；
 *  `limited.db.json` = **活动期条目**（limited + 版本活动每日，带 until/deadline，到期即删）。
 *  两文件在**此处合并**为一份条目集 —— 下游（store / domain / UI / 用户数据）对拆分无感知。
 *  日常维护去向：加限时活动 / 版本活动每日任务 → limited.db.json；改常驻玩法 → items.db.json。
 *  历史注记：迁移脚本是一次性工具已删除（重跑会回退后续模型演进），维护直接改 JSON。 */
export const seedItems = [...itemsDbRaw.items, ...limitedDbRaw.items] as unknown as Item[];

/** 用户库种子（只读；用户数据实际读写走 localStorage 分片键） */
export const seedUsersDb = usersDbRaw as unknown as UsersDbFile;

/** 版本库 */
export const seedVersions = dataVersionDbRaw.versions as unknown as VersionRow[];

/* ── 工具模块：动态 import，首屏 bundle 不含 ── */

export const loadYuhunDb = async (): Promise<YuhunDb> =>
  (await import('../../db/yuhun.db.json')).default as unknown as YuhunDb;

export const loadBountyDb = async (): Promise<BountyDb> =>
  (await import('../../db/bounty.db.json')).default as unknown as BountyDb;

export const loadSoulsDb = async (): Promise<SoulsDb> =>
  (await import('../../db/souls.db.json')).default as unknown as SoulsDb;
