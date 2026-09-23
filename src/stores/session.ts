import { create } from 'zustand';
import { api } from '../api';
import type { Profile, ProfileDraft, Session } from '../api/types';
import { useUiStore } from './ui';

/**
 * 会话 / 账号（设计文档 §7.3 / §6.4）。
 * 落盘键：`yys:meta:session`（会话指针）+ `yys:profiles`（账号列表）；写入时机：切号 / 增删改账号。
 *
 * `profiles` 存**全部账号（含已归档）**：
 *   - 切换器只渲染未归档的（`aliveProfiles`）；
 *   - 设置页需要看到已归档的才能「恢复」。
 * 让契约保持单一 `listProfiles(userId)`（不加参数），过滤规则放 UI —— 因为"归档"的语义本就是
 * 「不出现在日常入口」，而不是「数据不可见」。
 *
 * 账号变更**不做乐观更新**：待写入确认后再更新列表，避免切到一半失败造成状态分裂。
 */
interface SessionState {
  session: Session | null;
  profiles: Profile[];
  error: Error | null;
  saving: boolean;
  applySession: (session: Session) => void;
  loadProfiles: (userId: string) => Promise<void>;
  /** 只换账号，不涉及登录 */
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (input: ProfileDraft) => Promise<Profile | null>;
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<void>;
  archiveProfile: (id: string) => Promise<void>;
  restoreProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setError: (error: Error | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  profiles: [],
  error: null,
  saving: false,

  applySession: (session) => set({ session }),

  loadProfiles: async (userId) => {
    try {
      set({ profiles: await api.listProfiles(userId), error: null });
    } catch (e) {
      console.error('[session] 账号列表加载失败', e);
      set({ error: e as Error });
    }
  },

  switchProfile: async (profileId) => {
    if (get().session?.profileId === profileId) return;
    try {
      const session = await api.switchProfile(profileId);
      /* 切号 = 全量重载：先亮骨架屏，再由 useBootstrap 清空旧账号内存态后重新聚合，
         否则旧账号的勾选/条目会在新账号名下闪一帧（§7.3）。 */
      useUiStore.getState().setBootstrapLoading(true);
      set({ session, error: null });
    } catch (e) {
      console.error('[session] 切号失败', e);
      set({ error: e as Error });
    }
  },

  createProfile: async (input) => {
    const { session } = get();
    if (!session) return null;
    set({ saving: true, error: null });
    try {
      const profile = await api.createProfile(session.userId, input);
      await get().loadProfiles(session.userId);
      return profile;
    } catch (e) {
      console.error('[session] 新建账号失败', e);
      set({ error: e as Error });
      return null;
    } finally {
      set({ saving: false });
    }
  },

  updateProfile: async (id, patch) => {
    const { session } = get();
    if (!session) return;
    set({ saving: true, error: null });
    try {
      await api.updateProfile(id, patch);
      await get().loadProfiles(session.userId);
    } catch (e) {
      console.error('[session] 更新账号失败', e);
      set({ error: e as Error });
    } finally {
      set({ saving: false });
    }
  },

  archiveProfile: async (id) => {
    const { session, profiles } = get();
    if (!session) return;
    /* 边界 §6.4：至少保留一个未归档账号 */
    const alive = profiles.filter((p) => !p.archived && p.userId === session.userId);
    if (alive.length <= 1) {
      set({ error: new Error('至少要保留一个账号，不能归档最后一个') });
      return;
    }
    await get().updateProfile(id, { archived: true });
    /* 归档的正好是当前账号 → 自动切到 sort 最小的存活账号 */
    if (session.profileId === id) {
      const next = alive.filter((p) => p.id !== id).sort((a, b) => a.sort - b.sort)[0];
      if (next) await get().switchProfile(next.id);
    }
  },

  restoreProfile: async (id) => {
    await get().updateProfile(id, { archived: false });
  },

  deleteProfile: async (id) => {
    const { session, profiles } = get();
    if (!session) return;
    const target = profiles.find((p) => p.id === id);
    if (!target) return;
    const alive = profiles.filter((p) => !p.archived && p.userId === session.userId);
    if (!target.archived && alive.length <= 1) {
      set({ error: new Error('至少要保留一个账号，不能删除最后一个') });
      return;
    }

    set({ saving: true, error: null });
    try {
      await api.deleteProfile(
        { userId: session.userId, profileId: session.profileId },
        id,
      );
      await get().loadProfiles(session.userId);
      /* 删的是当前账号 → 切到存活的默认账号（mock 内部已改会话指针，这里同步内存态） */
      if (session.profileId === id) {
        const next = get()
          .profiles.filter((p) => !p.archived && p.userId === session.userId)
          .sort((a, b) => a.sort - b.sort)[0];
        if (next) await get().switchProfile(next.id);
      }
    } catch (e) {
      console.error('[session] 删除账号失败', e);
      set({ error: e as Error });
    } finally {
      set({ saving: false });
    }
  },

  setError: (error) => set({ error }),
}));

/** 未归档账号（切换器用），按 sort 升序 */
export const aliveProfiles = (profiles: Profile[]): Profile[] =>
  profiles.filter((p) => !p.archived).sort((a, b) => a.sort - b.sort);

/** 当前账号（顶部常驻标识用；用户忘记自己在哪个号会勾错） */
export const currentProfile = (): Profile | null => {
  const { session, profiles } = useSessionStore.getState();
  if (!session) return null;
  return profiles.find((p) => p.id === session.profileId) ?? null;
};
