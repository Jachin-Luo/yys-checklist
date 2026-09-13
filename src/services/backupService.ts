/**
 * 备份用例编排（设计文档 §8.1 `services/` 的定位）—— 契约调用 + 文本序列化 + store 刷新。
 *
 * **载体是文本，不是文件**（设计决策）：导出产出 JSON 文本交给用户复制，
 * 导入接收用户粘贴的 JSON 文本。换设备时"把这段字发给自己"比"下载文件再想办法传过去"
 * 自然得多，手机上尤其明显。
 *
 * 放在 services 而不是组件里：导入要"解析 → 校验 → 写库 → 整库重载"四步编排，
 * 其中任何一步失败的呈现都必须一致，散在组件里迟早出现"某条失败路径忘了提示"。
 */
import { api } from '../api';
import { parseBundleText, serializeBundle, validateBundle, type BundleSummary } from '../domain/backup';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

function scopeOf() {
  const { session } = useSessionStore.getState();
  return session ? { userId: session.userId, profileId: session.profileId } : null;
}

export interface ExportResult {
  ok: boolean;
  /** 供用户复制的 JSON 文本 */
  text?: string;
  summary?: BundleSummary;
  error?: string;
}

/**
 * 导出**全部档案**（不只是当前档案）。
 * 备份的意义是"换设备后原样回来"，只导出当前档案会让另一个号悄悄丢掉。
 */
export async function exportBackupText(): Promise<ExportResult> {
  const scope = scopeOf();
  if (!scope) return { ok: false, error: '尚未加载完成，请稍后重试。' };
  try {
    const bundle = await api.exportUserData(scope);
    /* 自校验一遍再交给用户：导出的东西自己都读不回来，是最难排查的一类问题 */
    const checked = validateBundle(bundle, bundle.schemaVersion);
    return {
      ok: true,
      text: serializeBundle(bundle),
      summary: checked.ok ? checked.summary : undefined,
    };
  } catch (e) {
    console.error('[backup] 导出失败', e);
    return { ok: false, error: (e as Error).message };
  }
}

export interface PrepareResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
  summary?: BundleSummary;
}

/**
 * 第一步：解析 + 校验，只给结论，**不写库**。
 * 拆开的原因：导入是覆盖式写操作，必须先让用户看到"这段文本里到底有多少东西"。
 */
export async function prepareImportText(text: string): Promise<PrepareResult> {
  const parsed = parseBundleText(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const meta = await api.getMeta();
  const checked = validateBundle(parsed.value, meta.version);
  if (!checked.ok) return { ok: false, error: checked.error };
  return { ok: true, warnings: checked.warnings, summary: checked.summary };
}

/** 第二步：确认后写库并**整库重载**（重新解析文本，避免两步之间状态被换掉） */
export async function applyImportText(text: string): Promise<PrepareResult> {
  const scope = scopeOf();
  if (!scope) return { ok: false, error: '尚未加载完成，请稍后重试。' };

  const parsed = parseBundleText(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const meta = await api.getMeta();
  const checked = validateBundle(parsed.value, meta.version);
  if (!checked.ok) return { ok: false, error: checked.error };

  try {
    await api.importUserData(scope, checked.bundle);
    /* 导入会改档案列表与三份用户数据分片 —— 让首屏入口整体重跑一遍，
       复用 useBootstrap 的内存态清空顺序、取消守卫与错误呈现，
       而不是另写一份迟早会漂移的"局部刷新"。 */
    useUiStore.getState().refreshBootstrap();
    return { ok: true, warnings: checked.warnings, summary: checked.summary };
  } catch (e) {
    console.error('[backup] 导入失败', e);
    return { ok: false, error: (e as Error).message };
  }
}
