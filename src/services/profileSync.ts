/**
 * 档案间配置同步的用例编排 —— 与 `backupService` 同一层、同一风格：
 * 契约调用 + 领域纯函数 + 汇总结果，失败路径的呈现统一在这里，不散到组件里。
 *
 * ## 为什么契约侧没有"批量跨档案"方法
 *
 * 这里是**循环调用既有的 `saveXxx(scope)`**。一次同步最多几个档案、几项配置，
 * 请求数很小；而加一个批量契约方法要在 Mock 与 Http 各写一遍，
 * 还要定义"部分失败"的协议 —— 收益远小于成本。
 * 直接循环还有个好处：`assertScope` 会在 Mock 层逐个校验 profileId 归属当前用户，
 * 越权写入在数据层就被挡住（服务端同样应校验）。
 *
 * ## 写入是"逐档案、逐项"的，所以支持部分成功
 *
 * 用户勾了 3 项、选 2 个档案，可能第 2 个档案的第 2 项失败。
 * 这时**已经写成功的部分不回滚**（回滚比失败更糟：用户以为没生效，实际改了一半），
 * 而是如实汇总「哪些档案成功、哪些失败、失败原因」，让用户自己决定要不要重试。
 */
import { api } from '../api';
import type { DataScope } from '../api/contract';
import type { ItemOverrides } from '../api/types';
import { applyParts, type SyncPartKey, type SyncSource } from '../domain/sync';
import { useGuildTimeStore } from '../stores/guildTime';
import { useItemStore } from '../stores/items';
import { useNurtureStore } from '../stores/nurture';
import { useSessionStore } from '../stores/session';
import { useViewStore } from '../stores/view';

export interface SyncReport {
  ok: boolean;
  error?: string;
  /** 写入成功的档案名（便于提示里直接念名字） */
  succeeded: string[];
  /** 写入失败的档案名 + 原因 */
  failed: Array<{ name: string; reason: string }>;
}

const emptyOverrides = (profileId: string): ItemOverrides => ({
  profileId,
  custom: [],
  hidden: [],
  order: [],
  updatedAt: '',
});

/**
 * 把当前档案的指定配置项同步（覆盖）到 `targets`。
 *
 * 源数据取**内存态**而不是再请求一次：绑定时用户刚在设置页看过这些值，
 * 内存态就是它所见的；重新拉一次反而可能拿到与界面不一致的东西。
 * （这与 `check` / `view` 的乐观更新同一思路：界面即真相，落盘是后续动作。）
 */
export async function syncToProfiles(
  targets: readonly string[],
  keys: readonly SyncPartKey[],
): Promise<SyncReport> {
  const { session, profiles } = useSessionStore.getState();
  if (!session) return { ok: false, error: '尚未加载完成，请稍后重试。', succeeded: [], failed: [] };
  if (!targets.length) return { ok: false, error: '请先选择要同步到的档案。', succeeded: [], failed: [] };
  if (!keys.length) return { ok: false, error: '请先选择要同步的内容。', succeeded: [], failed: [] };

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? id;

  const items = useItemStore.getState();
  const source: SyncSource = {
    guildTime: useGuildTimeStore.getState().guildTime,
    plans: useNurtureStore.getState().records,
    view: useViewStore.getState().view,
    overrides: items.overrides ?? emptyOverrides(session.profileId),
  };

  /* 只有勾了 view / overrides 相关的项才需要读目标现值 —— 其余项是整表接管。
     目标对象里那两份假值永远不会被 `applyParts` 读到（它只在对应 key 命中时才取
     `target.view` / `target.overrides`），这样写省掉两次必然白读的请求。 */
  const needView = keys.includes('autoDaily') || keys.includes('viewPrefs');
  const needOverrides = keys.includes('customItems') || keys.includes('hidden');

  const succeeded: string[] = [];
  const failed: SyncReport['failed'] = [];

  for (const profileId of targets) {
    if (profileId === session.profileId) continue;
    const scope: DataScope = { userId: session.userId, profileId };
    try {
      const patch = applyParts(
        source,
        needView || needOverrides
          ? {
              guildTime: {},
              plans: [],
              view: needView ? await api.getView(scope) : source.view,
              overrides: needOverrides ? await api.getOverrides(scope) : source.overrides,
            }
          : source,
        keys,
      );

      if (patch.guildTime) await api.saveGuildTime(scope, patch.guildTime);
      if (patch.plans) await api.savePlans(scope, patch.plans);
      if (patch.view) await api.saveView(scope, patch.view);
      if (patch.overrides) await api.saveOverrides(scope, patch.overrides);

      succeeded.push(nameOf(profileId));
    } catch (e) {
      console.error(`[profileSync] 同步失败 profileId=${profileId}`, e);
      failed.push({ name: nameOf(profileId), reason: (e as Error).message });
    }
  }

  return { ok: failed.length === 0, succeeded, failed };
}
