/**
 * Mock 的内存用户库 + 分片读写 + 写操作串行队列。
 *
 * 分工（设计文档 §2 / §5.3）：
 *   - 本文件：把「字节」读成内存库、把内存库写回**对应分片键**，并提供越权校验与写队列；
 *   - `domain/merge.ts`：合并规则（纯函数）；
 *   - `adapter.ts`：把两者串起来，实现 ApiClient。
 *
 * 并发：写操作串行化（简单队列），避免 localStorage 互相覆盖。
 */
import type { DataScope } from '../contract';
import type { CheckState, ItemOverrides, Profile, Session, User, ViewPrefs } from '../types';
import { ApiError } from './latency';
import { KEY, read, removeProfileShards, write } from './persist';
import { seedUsersDb } from './db';

export interface UserStore {
  users: User[];
  session: Session;
  profiles: Profile[];
  states: Record<string, CheckState>;
  views: Record<string, ViewPrefs | undefined>;
  overrides: Record<string, ItemOverrides | undefined>;
}

export const nowIso = (): string => new Date().toISOString();

export function emptyState(profileId: string, userId: string, at = nowIso()): CheckState {
  return { profileId, userId, checked: {}, updatedAt: at };
}

export function emptyOverrides(profileId: string, at = nowIso()): ItemOverrides {
  return { profileId, custom: [], hidden: [], order: [], updatedAt: at };
}

let cached: UserStore | null = null;

/**
 * 会话指针 → `Session`。
 * `sessions` 表只存「谁、在看哪个号」（§4.6 已降级为会话指针）；
 * `authType` 由 `users.authType` 提供，`token` 本期不落库。
 */
function toSession(
  row: { userId: string; profileId: string; authType?: string },
  users: User[],
): Session {
  const user = users.find((u) => u.id === row.userId);
  return {
    userId: row.userId,
    profileId: row.profileId,
    authType: (row.authType as Session['authType']) ?? user?.authType ?? 'local',
  };
}

/** 启动时组装一次：`内存库 = 种子 JSON + localStorage 覆盖层` */
export function ensureStore(): UserStore {
  if (cached) return cached;
  const sessionRow = read<{ userId: string; profileId: string; authType?: string }>(KEY.session)
    ?? seedUsersDb.sessions[0];
  const session = toSession(sessionRow, seedUsersDb.users);
  const profiles: Profile[] = read<Profile[]>(KEY.profiles) ?? seedUsersDb.profiles;

  const states: UserStore['states'] = {};
  const views: UserStore['views'] = {};
  const overrides: UserStore['overrides'] = {};
  for (const p of profiles) {
    states[p.id] = read<CheckState>(KEY.state(p.id))
      ?? seedUsersDb.states.find((s) => s.profileId === p.id)
      ?? emptyState(p.id, p.userId);
    views[p.id] = read<ViewPrefs>(KEY.view(p.id))
      ?? seedUsersDb.viewPrefs.find((v) => v.profileId === p.id);
    overrides[p.id] = read<ItemOverrides>(KEY.ovr(p.id))
      ?? seedUsersDb.itemOverrides.find((o) => o.profileId === p.id)
      ?? emptyOverrides(p.id);
  }
  cached = { users: seedUsersDb.users.slice(), session, profiles, states, views, overrides };
  return cached;
}

/** 供单测重置内存态 */
export function resetStoreForTest(): void {
  cached = null;
}

/** 越权校验：显式带 userId 的价值就在这里（服务端可同样校验） */
export function assertScope(scope: DataScope): void {
  const s = ensureStore();
  if (scope.userId !== s.session.userId) {
    throw new ApiError('E_FORBIDDEN', `[mock] userId=${scope.userId} 与会话不符`);
  }
  if (!s.profiles.some((p) => p.id === scope.profileId && p.userId === scope.userId)) {
    throw new ApiError('E_FORBIDDEN', `[mock] profileId=${scope.profileId} 不属于该用户`);
  }
}

/* ── 会话 / 档案 ── */

export function saveSession(session: Session): void {
  const s = ensureStore();
  write(KEY.session, session);
  s.session = session;
}

export function saveProfiles(profiles: Profile[]): void {
  const s = ensureStore();
  write(KEY.profiles, profiles);
  s.profiles = profiles;
}

/* ── 分片读写（只写对应分片，不整库重写）── */

export function readStateShard(profileId: string): CheckState {
  const s = ensureStore();
  return s.states[profileId] ?? emptyState(profileId, s.session.userId);
}

export function saveStateShard(state: CheckState): void {
  const s = ensureStore();
  const next = { ...state, updatedAt: nowIso() };
  write(KEY.state(state.profileId), next);
  s.states[state.profileId] = next;
}

export function readViewShard(profileId: string): ViewPrefs | undefined {
  return ensureStore().views[profileId];
}

export function saveViewShard(view: ViewPrefs): void {
  const s = ensureStore();
  const next = { ...view, updatedAt: nowIso() };
  write(KEY.view(view.profileId), next);
  s.views[view.profileId] = next;
}

export function readOverridesShard(profileId: string): ItemOverrides {
  const s = ensureStore();
  return s.overrides[profileId] ?? emptyOverrides(profileId);
}

export function saveOverridesShard(ov: ItemOverrides): void {
  const s = ensureStore();
  const next = { ...ov, updatedAt: nowIso() };
  write(KEY.ovr(ov.profileId), next);
  s.overrides[ov.profileId] = next;
}

export function dropProfileShards(profileId: string): void {
  const s = ensureStore();
  removeProfileShards(profileId);
  delete s.states[profileId];
  delete s.views[profileId];
  delete s.overrides[profileId];
}

/* ── 写操作串行队列 ── */

let queue: Promise<unknown> = Promise.resolve();

export function enqueue<T>(task: () => T | Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
