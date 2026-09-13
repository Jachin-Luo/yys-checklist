/**
 * Mock Adapter：`MockApi implements ApiClient`（设计文档 §5.3）。
 *
 * 职责：把「种子 + 分片字节」读进来 → 调 `domain/merge.ts` 合并 → 返回；
 *       写操作成功落盘后提交内存库，只写**对应分片键**，整体串行化。
 * **不写任何合并规则**（那在 domain，见 §2 铁律）。
 */
import { nanoid } from 'nanoid';
import type { ApiClient, DataScope } from '../contract';
import type {
  BountyDb, BootstrapPayload, CheckState, Item, ItemDraft, ItemOverrides, Meta,
  Profile, ProfileDraft, Session, SoulsDb, User, UserDataBundle, ViewPrefs, YuhunDb,
} from '../types';
import { activeItems, mergeChecked, type ResetCtx } from '../../domain/reset';
import { buildMeta, effectiveView, mergeItems } from '../../domain/merge';
import { loadBountyDb, loadSoulsDb, loadYuhunDb, seedItems, seedMetaDb, seedVersions } from './db';
import { injectFailure, mainDelay, writeDelay } from './latency';
import * as store from './userStore';

export function assembleMeta(): Meta {
  return buildMeta(seedMetaDb.meta, seedMetaDb.dicts, seedMetaDb.sortOptions, seedMetaDb.viewDefaults);
}

function resetCtx(meta: Meta): ResetCtx {
  return { resetHour: meta.resetHour, periods: meta.periods };
}

/** 有效条目：合并覆盖层 + 过滤已下线条目 */
function effectiveItems(profileId: string, now: Date): Item[] {
  return activeItems(mergeItems(seedItems, store.readOverridesShard(profileId)), now);
}

/** 勾选状态：读取时按当前周期起点归零（不靠定时器） */
function computedState(profileId: string, items: Item[], now: Date): CheckState {
  const raw = store.readStateShard(profileId);
  return { ...raw, checked: mergeChecked(raw.checked, items, now, resetCtx(assembleMeta())) };
}

const newId = (prefix: string) => `${prefix}_${nanoid(6)}`;

export class MockApi implements ApiClient {
  /* ── 系统 ── */

  async getMeta(): Promise<Meta> {
    injectFailure('getMeta');
    await mainDelay();
    return assembleMeta();
  }

  async getBootstrap(scope: DataScope): Promise<BootstrapPayload> {
    injectFailure('getBootstrap');
    await mainDelay();
    store.assertScope(scope);
    const now = new Date();
    const meta = assembleMeta();
    const items = effectiveItems(scope.profileId, now);
    const rawOverrides = store.readOverridesShard(scope.profileId);
    return {
      meta,
      items,
      session: store.ensureStore().session,
      state: computedState(scope.profileId, items, now),
      view: effectiveView(meta.viewDefaults, store.readViewShard(scope.profileId)),
      overrides: rawOverrides,
    };
  }

  /* ── 条目（主数据，只读） ── */

  async listItems(q: { cycle?: Item['cycle']; kind?: string; dow?: number } = {}): Promise<Item[]> {
    injectFailure('listItems');
    await mainDelay();
    return seedItems.filter((it) => {
      if (q.cycle && it.cycle !== q.cycle) return false;
      if (q.kind && !(it.gainKind || []).includes(q.kind as never)) return false;
      if (q.dow !== undefined && it.days && !it.days.includes(q.dow)) return false;
      return true;
    });
  }

  async getItem(id: string): Promise<Item | null> {
    injectFailure('getItem');
    await mainDelay();
    return seedItems.find((it) => it.id === id) ?? null;
  }

  /* ── 工具模块（懒加载） ── */

  async getYuhun(): Promise<YuhunDb> {
    injectFailure('getYuhun');
    await mainDelay();
    return loadYuhunDb();
  }

  async getBounty(): Promise<BountyDb> {
    injectFailure('getBounty');
    await mainDelay();
    return loadBountyDb();
  }

  async getSouls(): Promise<SoulsDb> {
    injectFailure('getSouls');
    await mainDelay();
    return loadSoulsDb();
  }

  /* ── 用户与鉴权 ── */

  async getSession(): Promise<Session> {
    injectFailure('getSession');
    await mainDelay();
    return store.ensureStore().session;
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    injectFailure('updateUser');
    await writeDelay();
    return store.enqueue(() => {
      const s = store.ensureStore();
      const idx = s.users.findIndex((u) => u.id === id);
      if (idx < 0) throw new Error(`[mock] user 不存在: ${id}`);
      const next = { ...s.users[idx], ...patch, id, lastActiveAt: store.nowIso() };
      s.users[idx] = next;
      return next;
    });
  }

  /* ── 游戏档案 ── */

  /**
   * 返回该用户的**全部**档案（含已归档），按 sort 升序。
   *
   * 为什么不过滤归档：设计文档 §6.4 要求「归档的档案不出现在切换器，但设置页可恢复」——
   * 若这里就滤掉，设置页永远看不到它们，恢复能力无从实现。契约只有 `listProfiles(userId)`
   * 一个方法（不加参数），因此把「归档不出现在日常入口」这条规则放在 UI 层（切换器过滤），
   * 语义也更准确：归档 = 收起来，不是删掉。
   * `switchProfile` 仍会拒绝归档档案 —— 那条约束在服务端/适配器侧强制。
   */
  async listProfiles(userId: string): Promise<Profile[]> {
    injectFailure('listProfiles');
    await mainDelay();
    return store.ensureStore().profiles
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.sort - b.sort);
  }

  async createProfile(userId: string, input: ProfileDraft): Promise<Profile> {
    injectFailure('createProfile');
    await writeDelay();
    return store.enqueue(() => {
      const s = store.ensureStore();
      if (!s.users.some((u) => u.id === userId)) throw new Error(`[mock] user 不存在: ${userId}`);
      const at = store.nowIso();
      const alive = s.profiles.filter((p) => p.userId === userId);
      const profile: Profile = {
        id: newId('p'),
        userId,
        name: input.name,
        server: input.server,
        channel: input.channel,
        uid: input.uid,
        level: input.level,
        avatar: input.avatar,
        isDefault: alive.length === 0,
        sort: alive.reduce((m, p) => Math.max(m, p.sort), 0) + 1,
        archived: false,
        createdAt: at,
        updatedAt: at,
      };
      store.saveProfiles([...s.profiles, profile]);
      /* 立刻初始化该档案的三份空数据（设计文档 §5.5 ProfileDraft 说明） */
      store.saveStateShard(store.emptyState(profile.id, userId, at));
      store.saveViewShard(effectiveView(seedMetaDb.viewDefaults, { profileId: profile.id }));
      store.saveOverridesShard(store.emptyOverrides(profile.id, at));
      return profile;
    });
  }

  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    injectFailure('updateProfile');
    await writeDelay();
    return store.enqueue(() => {
      const s = store.ensureStore();
      const idx = s.profiles.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`[mock] profile 不存在: ${id}`);
      const merged = { ...s.profiles[idx], ...patch, id, updatedAt: store.nowIso() };
      let list = s.profiles.map((p, i) => (i === idx ? merged : p));
      if (merged.isDefault) list = list.map((p) => (p.id === id ? p : { ...p, isDefault: false }));
      store.saveProfiles(list);
      return merged;
    });
  }

  async deleteProfile(scope: DataScope, id: string): Promise<void> {
    injectFailure('deleteProfile');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const s = store.ensureStore();
      const removed = s.profiles.find((p) => p.id === id);
      if (!removed) throw new Error(`[mock] profile 不存在: ${id}`);
      /* 边界 §6.4：保护的是「至少要有一个**存活**档案」——
         删已归档的档案不该被这条规则挡住（它本来就不在存活集合里）。 */
      const alive = s.profiles.filter((p) => !p.archived && p.userId === scope.userId);
      if (!removed.archived && alive.length <= 1) {
        throw new Error('[mock] 至少保留一个档案，禁止删除最后一个');
      }
      let list = s.profiles.filter((p) => p.id !== id);
      if (removed?.isDefault) {
        const next = list.filter((p) => p.userId === scope.userId).sort((a, b) => a.sort - b.sort)[0];
        if (next) list = list.map((p) => (p.id === next.id ? { ...p, isDefault: true } : p));
      }
      store.saveProfiles(list);
      store.dropProfileShards(id);
      if (s.session.profileId === id) {
        const next = list.filter((p) => p.userId === scope.userId).sort((a, b) => a.sort - b.sort)[0];
        if (next) store.saveSession({ ...s.session, profileId: next.id });
      }
    });
  }

  async switchProfile(profileId: string): Promise<Session> {
    injectFailure('switchProfile');
    await writeDelay();
    return store.enqueue(() => {
      const s = store.ensureStore();
      const profile = s.profiles.find((p) => p.id === profileId);
      if (!profile) throw new Error(`[mock] profile 不存在: ${profileId}`);
      if (profile.archived) throw new Error('[mock] 档案已归档，不能切换');
      const session: Session = { ...s.session, profileId };
      store.saveSession(session);
      return session;
    });
  }

  /* ── 用户数据（增量写入，每档案分片） ── */

  async getState(scope: DataScope): Promise<CheckState> {
    injectFailure('getState');
    await mainDelay();
    store.assertScope(scope);
    return computedState(scope.profileId, effectiveItems(scope.profileId, new Date()), new Date());
  }

  async setChecked(scope: DataScope, itemId: string, at: number | null): Promise<void> {
    injectFailure('setChecked');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const shard = store.readStateShard(scope.profileId);
      const checked = { ...shard.checked };
      if (at === null) delete checked[itemId];
      else checked[itemId] = at;
      store.saveStateShard({ ...shard, checked });
    });
  }

  async clearChecked(scope: DataScope, itemIds: string[]): Promise<void> {
    injectFailure('clearChecked');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const shard = store.readStateShard(scope.profileId);
      const checked = { ...shard.checked };
      itemIds.forEach((id) => delete checked[id]);
      store.saveStateShard({ ...shard, checked });
    });
  }

  async clearAllChecked(scope: DataScope): Promise<void> {
    injectFailure('clearAllChecked');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      store.saveStateShard({ ...store.readStateShard(scope.profileId), checked: {} });
    });
  }

  async getView(scope: DataScope): Promise<ViewPrefs> {
    injectFailure('getView');
    await mainDelay();
    store.assertScope(scope);
    return effectiveView(assembleMeta().viewDefaults, store.readViewShard(scope.profileId));
  }

  async saveView(scope: DataScope, view: ViewPrefs): Promise<void> {
    injectFailure('saveView');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      store.saveViewShard(effectiveView(assembleMeta().viewDefaults, { ...view, profileId: scope.profileId }));
    });
  }

  async getOverrides(scope: DataScope): Promise<ItemOverrides> {
    injectFailure('getOverrides');
    await mainDelay();
    store.assertScope(scope);
    return store.readOverridesShard(scope.profileId);
  }

  async saveOverrides(scope: DataScope, ov: ItemOverrides): Promise<void> {
    injectFailure('saveOverrides');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      store.saveOverridesShard({ ...ov, profileId: scope.profileId });
    });
  }

  /* ── 条目增删（语义封装，内部改写 overrides） ── */

  async addCustomItem(scope: DataScope, draft: ItemDraft): Promise<Item> {
    injectFailure('addCustomItem');
    await writeDelay();
    return store.enqueue(() => {
      store.assertScope(scope);
      const item: Item = {
        id: newId('custom'),
        name: draft.name,
        cycle: draft.cycle,
        gainKind: draft.gainKind,
        gain: draft.gain,
        deadline: draft.deadline,
        time: draft.time,
        timeEnd: draft.timeEnd,
        path: draft.path,
        condition: draft.condition,
        note: draft.note,
        origin: 'custom',
      };
      const ov = store.readOverridesShard(scope.profileId);
      store.saveOverridesShard({ ...ov, custom: [...ov.custom, item] });
      return item;
    });
  }

  async removeCustomItem(scope: DataScope, itemId: string): Promise<void> {
    injectFailure('removeCustomItem');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const ov = store.readOverridesShard(scope.profileId);
      store.saveOverridesShard({
        ...ov,
        custom: ov.custom.filter((it) => it.id !== itemId),
        order: ov.order.filter((id) => id !== itemId),
      });
      const shard = store.readStateShard(scope.profileId);
      const checked = { ...shard.checked };
      delete checked[itemId];
      store.saveStateShard({ ...shard, checked });
    });
  }

  async hideItem(scope: DataScope, itemId: string): Promise<void> {
    injectFailure('hideItem');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const ov = store.readOverridesShard(scope.profileId);
      if (ov.hidden.includes(itemId)) return;
      store.saveOverridesShard({ ...ov, hidden: [...ov.hidden, itemId] });
    });
  }

  async restoreItem(scope: DataScope, itemId: string): Promise<void> {
    injectFailure('restoreItem');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const ov = store.readOverridesShard(scope.profileId);
      store.saveOverridesShard({ ...ov, hidden: ov.hidden.filter((id) => id !== itemId) });
    });
  }

  async resetItemLibrary(scope: DataScope): Promise<void> {
    injectFailure('resetItemLibrary');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const ov = store.readOverridesShard(scope.profileId);
      store.saveOverridesShard({ ...ov, custom: [], hidden: [], order: [] });
    });
  }

  async saveOrder(scope: DataScope, order: string[]): Promise<void> {
    injectFailure('saveOrder');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const ov = store.readOverridesShard(scope.profileId);
      store.saveOverridesShard({ ...ov, order });
    });
  }

  /* ── 导入导出（S7） ── */

  async exportUserData(scope: DataScope): Promise<UserDataBundle> {
    injectFailure('exportUserData');
    await mainDelay();
    store.assertScope(scope);
    const s = store.ensureStore();
    const profiles = s.profiles.filter((p) => p.userId === scope.userId);
    return {
      schemaVersion: assembleMeta().version,
      exportedAt: store.nowIso(),
      profiles,
      data: profiles.map((p) => ({
        profileId: p.id,
        state: store.readStateShard(p.id),
        view: effectiveView(seedMetaDb.viewDefaults, store.readViewShard(p.id)),
        overrides: store.readOverridesShard(p.id),
      })),
    };
  }

  async importUserData(scope: DataScope, bundle: UserDataBundle): Promise<void> {
    injectFailure('importUserData');
    await writeDelay();
    await store.enqueue(() => {
      store.assertScope(scope);
      const s = store.ensureStore();
      const incoming = bundle.profiles.filter((p) => p.userId === scope.userId);
      const others = s.profiles.filter((p) => p.userId !== scope.userId);
      store.saveProfiles([...others, ...incoming]);
      for (const row of bundle.data) {
        if (!incoming.some((p) => p.id === row.profileId)) continue;
        store.saveStateShard({ ...row.state, profileId: row.profileId });
        store.saveViewShard({ ...row.view, profileId: row.profileId });
        store.saveOverridesShard({ ...row.overrides, profileId: row.profileId });
      }
    });
  }
}

/** 版本库读取（S7 数据版本提示用；此处暴露以便契约单测覆盖） */
export const readVersions = () => seedVersions;
