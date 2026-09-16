/**
 * 用户数据分片键 —— **只负责拼键与清分片**，字节读写统一在 `services/localStore.ts`。
 *
 * 本文件**不含任何合并规则**（谁覆盖谁、冲突怎么解都在 `domain/merge.ts`）。
 * 分层铁律：Mock 只做 IO。
 *
 * 存储分片（v1.3 修正，已废弃单一 `yys:db:userdata` 大键；2026-09-16 新增两片）：
 *   yys:meta:session      会话指针（userId / profileId）        切号时写
 *   yys:profiles          档案列表（全档案共用一份）              增删改档案时写
 *   yys:state:{profileId} 该档案的勾选状态                       每次勾选（高频，必须最小）
 *   yys:checklog:{profileId} 该档案的勾选日志（按日期分桶的历史）   勾选时写（保留 90 天）
 *   yys:view:{profileId}  该档案的视图偏好                       改筛选/排序时写
 *   yys:ovr:{profileId}   该档案的条目覆盖层                     增删条目/拖排序时写
 *   yys:guild:{profileId} 该档案的寮时间                         设置页改寮时间时写
 *   yys:plans:{profileId} 该档案的结界寄养任务 / 计划             增删改寄养记录时写
 *
 * 收益：勾选一条只重写 `yys:state:{profileId}`（约 1–2 KB，与档案数和自建条目数无关）。
 *
 * `yys:guild:*` / `yys:plans:*` 于 2026-09-16 由**设备级**升为**档案级**（用户决策）：
 * 寮时间与寄养节奏都因号而异（可能是代管他人的号、或两个号在两个寮），
 * 且只有变成档案级分片，它们才能被备份带走 —— 见 `UserDataBundle.data[]`。
 *
 * 设备级键（只剩 `yys:onboarded`）**不在这里** —— 引导标记不是配置项，
 * 而是"这台设备看过引导没有"的状态，见 `services/localStore.DEVICE_KEY`。
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
  /* 2026-09-16 新增：两片都由设备级升为档案级 */
  guild: (profileId: string) => `${NS}:guild:${profileId}`,
  plans: (profileId: string) => `${NS}:plans:${profileId}`,
} as const;

/** 清理某个档案的全部分片（删档时用）。**新增分片必须同步加在这里**，
 *  否则删档会留下孤儿键（`deleteProfile` 只调用本函数） */
export function removeProfileShards(profileId: string): void {
  remove(KEY.state(profileId));
  remove(KEY.view(profileId));
  remove(KEY.ovr(profileId));
  remove(KEY.checklog(profileId));
  remove(KEY.guild(profileId));
  remove(KEY.plans(profileId));
}
