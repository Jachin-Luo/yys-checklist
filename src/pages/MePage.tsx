import Segmented from '../components/common/Segmented';
import SettingRow from '../components/common/SettingRow';
import { SectionTitle } from '../components/common/EmptyState';
import BackupSection from '../components/settings/BackupSection';
import DataVersionSection from '../components/settings/DataVersionSection';
import { useItemStore } from '../stores/items';
import { useThemeStore, type Theme } from '../stores/theme';
import AutoDailySection from './settings/AutoDailySection';
import CardDisplaySection from './settings/CardDisplaySection';
import ClearDataSection from './settings/ClearDataSection';
import GuildTimeSection from './settings/GuildTimeSection';
import ItemManagerSection from './settings/ItemManagerSection';
import ProfileSection from './settings/ProfileSection';
import ProfileSyncSection from './settings/ProfileSyncSection';

/**
 * 设置页（一级页面；展示名 2026-09-23 由「我的」改为「设置」，
 * 内部 `NavKey` 仍是 `me` —— 它是标识符不是标签，改名只会平添跨文件改动）。
 *
 * ## 2026-09-23 整体重构（用户要求：该合并的合并，对齐参考稿的设置页）
 *
 * 上一版是 **9 个平级的折叠卡**，标题之间没有层次，找一项要逐个展开试。
 * 现在按参考稿的口径收成 **4 组**，组名走清单页同一套分组头（`SectionTitle`）：
 *
 * | 组 | 组内 | 形态 |
 * |---|---|---|
 * | 观感 | 界面主题 · 卡片显示字段 | **平铺设置行** |
 * | 委托 | 一键日常覆盖 · 条目管理 | 折叠（长列表） |
 * | 账号 | 游戏账号 · 同步到其他账号 · 寮时间 | 折叠（列表 / 表单） |
 * | 数据 | 数据版本 · 数据备份 · **清空记录** | 平铺 + 折叠（末位是危险区） |
 *
 * 为什么是**混合形态**而不是参考稿那种"全平铺"：参考稿的设置项全是单行控件
 * （分段 / 滑块 / 色板 / 开关），而本页有 5 个**长列表**——条目库 90+ 条、
 * 覆盖项清单、账号列表、寮时间逐条、备份大文本框。全展开会让这一页长到没法用。
 * 所以口径是：**能一行说完的平铺，需要展开看的收起**，而收起的那些靠 `summary`
 * 在收起状态下也给出关键结论（"已覆盖 12 项" / "存活 2 个" / "快照更新于 9/9"）。
 *
 * 组内顺序即"改动频率 × 影响面"：观感（高频、无风险）→ 委托（日常调）→
 * 账号（决定所有数据的归属）→ 数据（低频、只读/备份）。
 *
 * ## 2026-09-23 再收敛：页头整块去掉（用户要求）
 *
 * 「设置」标题、账号切换器、御币横饰一并移除，首屏直接进分组。三处都是**页内重复**：
 *   - 页面名：左栏（PC）与底部 Tab（移动端）已经高亮着当前页；
 *   - 账号切换器：两端壳层各常驻一个（桌面侧栏底部卡片 / 移动端顶栏），
 *     而且本页「账号」组里的「游戏账号」本来就能切号 —— 三处都能切，页内再放一个只会挤掉首屏；
 *   - 御币：纯装饰，与"设置页要一眼看到选项"的目标相反。
 * 顶部内缩随之由 `py-5` 收到 `pt-1`（分组头自带 `pt-4`，合计仍是约 20px）。
 *
 * 全部数据经 store（store 经 ApiClient 契约）取得 —— 不直连种子文件。
 */
const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: '明版' },
  { value: 'dark', label: '暗版' },
];

export default function MePage() {
  const meta = useItemStore((s) => s.meta);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  /* 行距 8px（册页稿 `.srows` 的 gap）—— 设置行不再带阴影，靠间隙彼此分开 */
  const rows = 'space-y-2';

  return (
    /* `mx-auto`：本页上限 672，桌面内容容器 1024 —— 不居中时设置分区整体贴左（与统计 / 工具两页同一口径） */
    <div className="mx-auto max-w-2xl px-3.5 pb-10 pt-1">
      {/* ── 观感 ── */}
      <SectionTitle icon="sun" flush>
        观感
      </SectionTitle>
      <div className={rows}>
        <SettingRow
          title="界面主题"
          /* 只留"跟随系统"这条不可自明的信息：明版 / 暗版是什么，分段控件的名字已经说了 */
          desc="未手动选择时跟随系统设置"
          control={
            <Segmented label="界面主题" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
          }
        />
        <CardDisplaySection />
      </div>

      {/* ── 委托 ── */}
      <SectionTitle icon="torii" flush>
        委托
      </SectionTitle>
      <div className={rows}>
        <AutoDailySection />
        <ItemManagerSection />
      </div>

      {/* ── 账号 ── */}
      <SectionTitle icon="hito" flush>
        账号
      </SectionTitle>
      <div className={rows}>
        <ProfileSection />
        <ProfileSyncSection />
        <GuildTimeSection />
      </div>

      {/* ── 数据 ── */}
      <SectionTitle icon="hako" flush>
        数据
      </SectionTitle>
      <div className={rows}>
        <DataVersionSection />
        <BackupSection />
        {/* 危险区排在组内最后（2026-09-24 用户要求新增）：本组其它分区都是只读或可逆操作，
            而它是不可撤销的 —— 放在末尾既符合"影响面从小到大"，也让它在滚动路径上最后一次出现 */}
        <ClearDataSection />
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-3">{meta?.disclaimer}</p>
    </div>
  );
}
