import { create } from 'zustand';
import { api } from '../api';
import type { GuildTimePrefs } from '../api/types';
import { withGuildTime } from '../domain/guildTime';
import { useSessionStore } from './session';

/**
 * 寮时间（**账号级**，2026-09-16 由设备级升格）。
 *
 * 落盘键：`yys:guild:{profileId}`；读路径：首屏 `getBootstrap().guildTime`；
 * 写路径与 `stores/view` 同一形态 —— **乐观更新 + 失败回滚**（改一个时间点不值得等一个往返）。
 *
 * 为什么不给 `GuildTimePrefs` 包一层 `{ profileId, updatedAt }`：
 * 分片键里已经有 profileId，表本身就是一个纯 map；包一层只会多出两个可能与键不一致的字段。
 * `updatedAt` 由 `saveGuildTimeShard` 在写入时盖（与 state / view 的既有做法一致）。
 */
interface GuildTimeState {
  guildTime: GuildTimePrefs;
  error: Error | null;
  /** 首屏 / 切号时灌入（`useBootstrap` 是唯一生产调用点） */
  applyGuildTime: (prefs: GuildTimePrefs) => void;
  /** 写一条：值传空串 = 删除该条配置（与 `domain/guildTime.withGuildTime` 的语义一致） */
  setGuildTime: (itemId: string, value: string) => Promise<void>;
  clearGuildTime: () => Promise<void>;
}

/**
 * 写入序号：**只有最新一次写入的失败才允许回滚**。
 * 寮时间是"逐条输入"的，用户很可能连续改两三个时间点 ——
 * 先失败的那次若后返回，会把后面几次的输入一起抹掉（理由同 `stores/nurture`）。
 */
let writeSeq = 0;

export const useGuildTimeStore = create<GuildTimeState>((set, get) => {
  const persist = async (next: GuildTimePrefs) => {
    const prev = get().guildTime;
    const mine = ++writeSeq;
    set({ guildTime: next, error: null });
    const { session } = useSessionStore.getState();
    if (!session) return;
    try {
      await api.saveGuildTime({ userId: session.userId, profileId: session.profileId }, next);
    } catch (e) {
      console.error('[guildTime] 保存失败，回滚', e);
      if (mine !== writeSeq) return;
      set({ guildTime: prev, error: e as Error });
    }
  };

  return {
    guildTime: {},
    error: null,

    applyGuildTime: (guildTime) => set({ guildTime, error: null }),

    setGuildTime: (itemId, value) => persist(withGuildTime(get().guildTime, itemId, value)),

    clearGuildTime: () => persist({}),
  };
});

/**
 * 切号时清空内存态（由 `useBootstrap` 调用）。
 * 与 view / check 同理：新账号的首屏聚合返回前若还显示旧账号的寮时间，
 * 那些时间徽章会按"别人的寮"算一遍，用户可能据此判断"还没开始"而错过活动。
 */
export const resetGuildTimeMemory = (): void => {
  /* ++ 让在途写入的失败不再回滚到新账号上（见 `writeSeq` 的注释） */
  writeSeq += 1;
  useGuildTimeStore.setState({ guildTime: {}, error: null });
};
