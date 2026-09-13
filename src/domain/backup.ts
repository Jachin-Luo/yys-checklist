/**
 * 备份导入导出（设计文档 §5.5 `UserDataBundle` / §9 S7）—— 纯函数，无 IO。
 *
 * **为什么导入必须先校验**：备份文件是**用户手上的一份外部数据**，可能来自旧版本、
 * 被手工改过、或干脆选错了文件。直接塞进 `importUserData` 的后果是
 * 档案列表被半截数据覆盖 —— 用户丢的是无法恢复的勾选记录。
 * 因此这一层做两件事：**结构校验**（不合格就拒绝）+ **归一化**（只保留已知字段）。
 *
 * 校验刻意**不引入 JSON Schema 库**：Bundle 只有 4 个字段、2 层嵌套，
 * 手写校验可读性与错误信息可控性都更好，也少一个依赖。
 *
 * 版本差异**只警告不拒绝**：`schemaVersion` 不同不必然不兼容，
 * 拒绝会让用户连"试试看"的机会都没有；但必须显式告知，免得他以为"导入成功了所以没问题"。
 */
import type { UserDataBundle } from '../api/types';

/** 粘贴内容长度上限：正常备份 < 100 KB，超过这个量级八成是粘错了东西 */
export const MAX_BUNDLE_CHARS = 4_000_000;
/** 数据快照超过这么多天就提示"可能已过期"（"防静默过期"，需求 Q10） */
export const STALE_DAYS = 45;

export interface BundleSummary {
  /** 备份里的档案数 */
  profiles: number;
  /** 有勾选记录的条目数（跨全部档案求和） */
  checked: number;
  /** 自建条目数 */
  custom: number;
  /** 已隐藏的预设条目数 */
  hidden: number;
  /** 自定义排序条目数 */
  order: number;
}

export type ValidateResult =
  | { ok: true; bundle: UserDataBundle; warnings: string[]; summary: BundleSummary }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 未知结构一律当空记录处理：宁少不漏，绝不让畸形数据流进 shard */
function normalizeChecked(v: unknown): Record<string, number> {
  if (!isObj(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function summarize(bundle: UserDataBundle): BundleSummary {
  let checked = 0;
  let custom = 0;
  let hidden = 0;
  let order = 0;
  for (const row of bundle.data) {
    checked += Object.keys(row.state?.checked ?? {}).length;
    custom += row.overrides?.custom?.length ?? 0;
    hidden += row.overrides?.hidden?.length ?? 0;
    order += row.overrides?.order?.length ?? 0;
  }
  return { profiles: bundle.profiles.length, checked, custom, hidden, order };
}

/**
 * 校验并归一化备份。
 * @param raw 解析后的 JSON（`JSON.parse` 的结果，**未经信任**）
 * @param currentSchemaVersion 当前应用的 `meta.version`
 */
export function validateBundle(raw: unknown, currentSchemaVersion: string): ValidateResult {
  if (!isObj(raw)) return { ok: false, error: '文件内容不是一个 JSON 对象，可能选错了文件。' };
  if (typeof raw.schemaVersion !== 'string' || !raw.schemaVersion) {
    return { ok: false, error: '缺少 schemaVersion 字段，这不是本应用的备份文件。' };
  }
  if (!Array.isArray(raw.profiles)) {
    return { ok: false, error: '缺少 profiles 数组，备份文件结构不完整。' };
  }

  const warnings: string[] = [];
  if (raw.schemaVersion !== currentSchemaVersion) {
    warnings.push(
      `备份的数据结构版本是 ${raw.schemaVersion}，当前应用是 ${currentSchemaVersion}。字段若有增减可能读不全，导入前请自行确认。`,
    );
  }

  const profiles = raw.profiles.filter(
    (p): p is UserDataBundle['profiles'][number] =>
      isObj(p) && typeof p.id === 'string' && p.id.length > 0 && typeof p.userId === 'string',
  );
  if (profiles.length !== raw.profiles.length) {
    warnings.push(`有 ${raw.profiles.length - profiles.length} 条档案记录缺少 id/userId，已跳过。`);
  }
  if (!profiles.length) warnings.push('这个备份里没有任何档案，导入后不会改变现有数据。');

  const ids = new Set(profiles.map((p) => p.id));
  const rawData = Array.isArray(raw.data) ? raw.data : [];
  const data: UserDataBundle['data'] = [];

  for (const row of rawData) {
    if (!isObj(row) || typeof row.profileId !== 'string' || !ids.has(row.profileId)) continue;
    const profileId = row.profileId;
    const stateRaw = isObj(row.state) ? row.state : {};
    const viewRaw = isObj(row.view) ? row.view : {};
    const ovRaw = isObj(row.overrides) ? row.overrides : {};
    const owner = profiles.find((p) => p.id === profileId);

    data.push({
      profileId,
      state: {
        userId: str(stateRaw.userId) || owner?.userId || '',
        profileId,
        checked: normalizeChecked(stateRaw.checked),
        /* 时间戳只透传：写入方（mock 的 `saveStateShard`）自己会盖 `nowIso()`。
           领域层不发明时间 —— 否则这个函数就不纯了，也没法断言。 */
        updatedAt: str(stateRaw.updatedAt),
      },
      view: { ...viewRaw, profileId, updatedAt: str(viewRaw.updatedAt) } as UserDataBundle['data'][number]['view'],
      overrides: {
        profileId,
        custom: Array.isArray(ovRaw.custom)
          ? (ovRaw.custom as UserDataBundle['data'][number]['overrides']['custom'])
          : [],
        hidden: strArray(ovRaw.hidden),
        order: strArray(ovRaw.order),
        updatedAt: str(ovRaw.updatedAt),
      },
    });
  }

  if (rawData.length && !data.length) {
    return { ok: false, error: '备份里的数据行都无法对应到档案，文件可能已损坏。' };
  }
  if (data.length < rawData.length) {
    warnings.push(`有 ${rawData.length - data.length} 条数据行与档案对不上，已跳过。`);
  }

  const bundle: UserDataBundle = {
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    profiles,
    data,
  };
  return { ok: true, bundle, warnings, summary: summarize(bundle) };
}

export interface Freshness {
  /** 距数据更新日的天数；解析失败为 null */
  days: number | null;
  stale: boolean;
  text: string;
}

/**
 * 数据快照新鲜度（§4.1 `updated` 字段的 UI 用法，部署位置见"可选展示"）。
 * 只提示、不阻断 —— 数据过期不等于功能坏了，用户仍可继续用旧快照记录。
 */
export function dataFreshness(updated: string | undefined, now: Date = new Date()): Freshness {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updated ?? '');
  if (!m) return { days: null, stale: false, text: '更新日期未知' };
  const [, y, mo, d] = m;
  const then = new Date(+y, +mo - 1, +d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((today - then) / 86400000);
  const dateText = `${+mo}/${+d}`;
  if (days <= 0) return { days, stale: false, text: `数据快照更新于 ${dateText}（今天）` };
  return {
    days,
    stale: days > STALE_DAYS,
    text: `数据快照更新于 ${dateText}（${days} 天前）`,
  };
}

/**
 * 备份文本的载体（设计决策：**用文本复制粘贴，不走文件下载/上传**）。
 *
 * 为什么文本比文件更合适：换设备时最自然的动作是"把这段字发给自己"（微信/备忘录/邮件都行），
 * 而不是先下载一个文件、再想办法把文件传过去。手机上尤其明显 —— 文件下载后往往躺在
 * 「下载」目录里，导入时还要在文件选择器里翻。
 *
 * 缩进 2 空格：用户看得懂、能手工改（比如只恢复某一个档案），也便于发现粘贴被截断。
 */
export function serializeBundle(bundle: UserDataBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** 粘贴文本 → JSON。解析失败时给"能据以行动"的提示，而不是抛 `SyntaxError` */
export function parseBundleText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '内容为空，请先粘贴备份 JSON。' };
  if (trimmed.length > MAX_BUNDLE_CHARS) {
    return { ok: false, error: '内容过长，可能粘错了东西（正常的备份不到 100 KB）。' };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (e) {
    console.error('[backup] JSON 解析失败', e);
    return {
      ok: false,
      error: '不是合法的 JSON —— 常见原因是粘贴不完整、两头缺了 { }，或中间被聊天软件截断。',
    };
  }
}
