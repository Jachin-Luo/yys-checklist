/**
 * 用户数据分片键 —— **只负责拼键与清分片**，字节读写统一在 `services/localStore.ts`。
 *
 * 本文件**不含任何合并规则**（谁覆盖谁、冲突怎么解都在 `domain/merge.ts`）。
 * 分层铁律：Mock 只做 IO。
 *
 * 存储分片（v1.3 修正，已废弃单一 `yys:db:userdata` 大键）：
 *   yys:meta:session      会话指针（userId / profileId）        切号时写
 *   yys:profiles          档案列表（全档案共用一份）              增删改档案时写
 *   yys:state:{profileId} 该档案的勾选状态                       每次勾选（高频，必须最小）
 *   yys:checklog:{profileId} 该档案的勾选日志（按日期分桶的历史）   勾选时写（保留 90 天）
 *   yys:view:{profileId}  该档案的视图偏好                       改筛选/排序时写
 *   yys:ovr:{profileId}   该档案的条目覆盖层                     增删条目/拖排序时写
 *
 * 收益：勾选一条只重写 `yys:state:{profileId}`（约 1–2 KB，与档案数和自建条目数无关）。
 *
 * 设备级键（`yys:guildTime` / `yys:onboarded` / `yys:plans`）**不在这里** ——
 * 它们不属于用户数据模型，见 `services/localStore.DEVICE_KEY`。
 */
import { NS, read, remove, write } from '../../services/localStore';

export { read, remove, write };

export const KEY = {
  session: `${NS}:meta:session`,
  profiles: `${NS}:profiles`,
  state: (profileId: string) => `${NS}:state:${profileId}`,
  view: (profileId: string) => `${NS}:view:${profileId}`,
  ovr: (profileId: string) => `${NS}:ovr:${profileId}`,
  checklog: (profileId: string) => `${NS}:checklog:${profileId}`,
} as const;

/** 清理某个档案的全部分片（删档时用） */
export function removeProfileShards(profileId: string): void {
  remove(KEY.state(profileId));
  remove(KEY.view(profileId));
  remove(KEY.ovr(profileId));
  remove(KEY.checklog(profileId));
}
