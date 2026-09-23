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
import type {
  CheckLog,
  CheckState,
  GuildTimePrefs,
  ItemOverrides,
  NurturePlans,
  Profile,
  Session,
  User,
  ViewPrefs,
} from '../types';
import { sanitizePlans } from '../../domain/nurture';
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
  /** 勾选日志（按日期分桶的历史，2026-09-15 新增） */
  logs: Record<string, CheckLog | undefined>;
  /** 寮时间（账号级，2026-09-16 由设备级升格） */
  guildTimes: Record<string, GuildTimePrefs | undefined>;
  /** 结界寄养任务 / 计划（账号级，2026-09-16 由设备级升格） */
  plans: Record<string, NurturePlans | undefined>;
}

export const nowIso = (): string => new Date().toISOString();

export function emptyState(profileId: string, userId: string, at = nowIso()): CheckState {
  return { profileId, userId, checked: {}, updatedAt: at };
}

export function emptyOverrides(profileId: string, at = nowIso()): ItemOverrides {
  return { profileId, custom: [], hidden: [], order: [], updatedAt: at };
}

/**
 * 空日志。新账号、或从没勾过东西的账号都是这个形状。
 * 种子库里**没有**日志（`users.db.json` 不含该字段）—— 它是纯运行期数据，从无到有累积。
 */
export function emptyLog(profileId: string, userId: string, at = nowIso()): CheckLog {
  return { profileId, userId, days: {}, updatedAt: at };
}

/**
 * 空寮时间 / 空寄养列表。
 * 与 `emptyLog` 同理：两者都是纯运行期数据，种子库不含，从无到有累积。
 * 它们的空值就是"一个字面量"，所以不再包一层 `{ profileId, ... }` 结构
 * （分片键里已经有 profileId，重复写一遍只会多一处可能不一致的地方）。
 */
export const emptyGuildTime = (): GuildTimePrefs => ({});
export const emptyPlans = (): NurturePlans => [];

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
  const logs: UserStore['logs'] = {};
  const guildTimes: UserStore['guildTimes'] = {};
  const plans: UserStore['plans'] = {};
  for (const p of profiles) {
    states[p.id] = read<CheckState>(KEY.state(p.id))
      ?? seedUsersDb.states.find((s) => s.profileId === p.id)
      ?? emptyState(p.id, p.userId);
    views[p.id] = read<ViewPrefs>(KEY.view(p.id))
      ?? seedUsersDb.viewPrefs.find((v) => v.profileId === p.id);
    overrides[p.id] = read<ItemOverrides>(KEY.ovr(p.id))
      ?? seedUsersDb.itemOverrides.find((o) => o.profileId === p.id)
      ?? emptyOverrides(p.id);
    logs[p.id] = read<CheckLog>(KEY.checklog(p.id)) ?? emptyLog(p.id, p.userId);
    /* 这两片没有种子来源：种子库里不存在设备级 → 账号级的迁移，
       旧版本残留的 `yys:guildTime` / `yys:plans` 按用户决策**不做迁移**（直接作废） */
    guildTimes[p.id] = read<GuildTimePrefs>(KEY.guild(p.id)) ?? emptyGuildTime();
    plans[p.id] = read<NurturePlans>(KEY.plans(p.id)) ?? emptyPlans();
  }
  cached = {
    users: seedUsersDb.users.slice(),
    session,
    profiles,
    states,
    views,
    overrides,
    logs,
    guildTimes,
    plans,
  };
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

/* ── 会话 / 账号 ── */

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

export function readLogShard(profileId: string): CheckLog {
  const s = ensureStore();
  return s.logs[profileId] ?? emptyLog(profileId, s.session.userId);
}

export function saveLogShard(log: CheckLog): void {
  const s = ensureStore();
  const next = { ...log, updatedAt: nowIso() };
  write(KEY.checklog(log.profileId), next);
  s.logs[log.profileId] = next;
}

export function readGuildTimeShard(profileId: string): GuildTimePrefs {
  return ensureStore().guildTimes[profileId] ?? emptyGuildTime();
}

export function saveGuildTimeShard(profileId: string, prefs: GuildTimePrefs): void {
  const s = ensureStore();
  const next = { ...prefs };
  write(KEY.guild(profileId), next);
  s.guildTimes[profileId] = next;
}

export function readPlansShard(profileId: string): NurturePlans {
  /* 净化放在**读取入口**：分片字节是本机文件、备份是用户手上的外部文件，两者都可能被改坏，
     而一条 `base` 非法的记录会让 `recordPoints` 递推出 NaN（界面显示 "NaN:NaN"）。
     数据规则在 `domain/nurture.sanitizePlans` —— Mock 只做 IO，不写规则。 */
  return sanitizePlans(ensureStore().plans[profileId] ?? []);
}

export function savePlansShard(profileId: string, plans: NurturePlans): void {
  const s = ensureStore();
  const next = [...plans];
  write(KEY.plans(profileId), next);
  s.plans[profileId] = next;
}

export function dropProfileShards(profileId: string): void {
  const s = ensureStore();
  removeProfileShards(profileId);
  delete s.states[profileId];
  delete s.views[profileId];
  delete s.overrides[profileId];
  delete s.logs[profileId];
  delete s.guildTimes[profileId];
  delete s.plans[profileId];
}

/* ── 写操作串行队列 ── */

let queue: Promise<unknown> = Promise.resolve();

export function enqueue<T>(task: () => T | Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
