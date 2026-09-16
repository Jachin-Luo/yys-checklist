import ProfileSwitcher from '../components/common/ProfileSwitcher';
import BackupSection from '../components/settings/BackupSection';
import DataVersionSection from '../components/settings/DataVersionSection';
import { useItemStore } from '../stores/items';
import AutoDailySection from './settings/AutoDailySection';
import CardDisplaySection from './settings/CardDisplaySection';
import GuildTimeSection from './settings/GuildTimeSection';
import ItemManagerSection from './settings/ItemManagerSection';
import ProfileSection from './settings/ProfileSection';
import ProfileSyncSection from './settings/ProfileSyncSection';

/**
 * 我的 / 设置。
 *
 * **所有分区默认收起**（本轮按用户要求改）：设置项多且低频，全展开会让用户每次都要跨过
 * 一大片内容才能找到目标。收起不等于丢信息 —— 每个分区的 `summary` 里有关键结论
 * （"已覆盖 12 项" / "存活 2 个" / "快照更新于 9/9"），不展开也能确认状态。
 * 统一外壳见 `components/common/CollapsibleSection`。
 *
 * 分区顺序按"改动频率 × 影响面"排：档案（决定所有数据的归属）→ 同步到其他档案 →
 * 一键日常覆盖 → 条目管理 → 视图偏好 → 寮时间 → 数据版本 → 数据备份。
 *
 * 2026-09-16 新增两个分区：
 *   - 「同步到其他档案」紧跟在「档案管理」之后 —— 寮时间与寄养任务升为档案级后
 *     多号要各配一遍，它是同一类跨档案操作，离得近才好找；
 *   - 「视图偏好」跟在「条目管理」之后 —— 两者都是"清单长什么样"的调整，
 *     它控制的是每张卡片显示哪些字段（见 `domain/cardDisplay`）。
 *
 * 全部数据经 store（store 经 ApiClient 契约）取得 —— 不直连种子文件。
 */
export default function MePage() {
  const meta = useItemStore((s) => s.meta);

  return (
    /* `mx-auto`：本页上限 672，桌面内容容器 1024 —— 不居中时设置分区整体贴左（与统计 / 工具两页同一口径） */
    <div className="mx-auto max-w-2xl px-3.5 py-5 pb-10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-medium text-ink">我的</h2>
        <ProfileSwitcher />
      </div>

      <ProfileSection />

      <ProfileSyncSection />

      <AutoDailySection />

      <ItemManagerSection />

      <CardDisplaySection />

      <GuildTimeSection />

      <DataVersionSection />

      <BackupSection />

      <p className="mt-5 text-sm leading-relaxed text-ink-3">{meta?.disclaimer}</p>
    </div>
  );
}
