import NavContent from '../common/NavContent';
import NurtureBadge from '../common/NurtureBadge';
import ProfileSwitcher from '../common/ProfileSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import Icon from '../icons/Icon';
import { NAV_ICON } from '../icons/navIcons';
import { OfudaDeco, Texture } from '../ornament';
import { NAV_ITEMS, useUiStore } from '../../stores/ui';

/**
 * PC 端布局骨架（设计文档 §8.3）：左侧固定导航 + 右侧多列栅格。
 * 与手机端共享数据层、状态层、domain 与 common 原子件，只改排列方式。
 *
 * 2026-09-23 换肤（**布局保持不变** —— 用户决策：左栏导航 + 双列网格照旧，
 * 参考稿那种 720px 居中单面板不落地）：
 *   - 根节点去掉不透明底色，让 `body` 的麻叶纹底纹透出来；
 *   - 侧栏铺自己的底纹 + 右缘金线，导航项改成"竖排符纸签"（选中 = 卡底 + 金描边 + 左缘朱红短线）；
 *   - 侧栏右缘挂御灵符装饰（`z-30` + `pointer-events-none`，落在留白里，不压内容）。
 *
 * 2026-09-23 页头改为品牌锁定「囤囤鼠 / 阴阳师任务清单」（用户要求，与移动端顶栏同一句）：
 *   主标题 `text-2xl`(19px) + `tracking-title`，副标题 `text-2xs`(10px) + `tracking-label`。
 *   两者差 1.9 倍 —— 第一版是 14.5px / 12px，几乎看不出主次（详见 `MobileShell` 的同一段说明）。
 */
export default function DesktopShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);

  return (
    <div className="flex h-full">
      {/* ⚠️ **不要给这个 aside 加 `overflow-hidden`**（2026-09-23 踩过一次）：
          底纹 `Texture` 是 `absolute inset-0`，本来就不会溢出，加裁剪只会把
          `ProfileSwitcher` 的下拉（absolute + 向上弹）整片裁掉 —— 账号切换弹窗
          "点开看不到"的根因就在这里。容器侧的安全做法是让纹样自己收敛，而不是裁剪父级。 */}
      <aside className="relative flex w-56 flex-none flex-col border-r border-line bg-surface-3 px-3 py-4">
        <Texture dots />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2 px-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon name="seimei" size={16} className="flex-none text-crimson" />
                <h1 className="truncate font-serif text-2xl tracking-title text-ink">囤囤鼠</h1>
              </div>
              {/* 副标题与移动端顶栏同一句（用户要求）：两端页头是同一套品牌锁定。
                  原先这里写的是"纯手动记录 · 不读取游戏数据" —— 那句免责在 README、
                  冷启动引导与「数据备份」说明里都有，页头不必重复第三遍 */}
              <p className="mt-2 truncate text-2xs tracking-label text-ink-3">阴阳师任务清单</p>
            </div>
            <ThemeToggle />
          </div>

          <nav className="mt-5 flex flex-col gap-1">
            {NAV_ITEMS.map(({ key, label }) => {
              const active = nav === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNav(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 text-base transition-colors duration-120 ${
                    active
                      ? 'border-line bg-surface font-medium text-gold-hi shadow-card'
                      : 'border-transparent text-ink-2 hover:border-line-soft hover:bg-surface/60'
                  }`}
                >
                  {/* 选中签的左缘朱红短线（参考稿顶部朱线的竖排变体） */}
                  {active ? (
                    <i className="absolute -left-px top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-crimson" />
                  ) : null}
                  <Icon name={NAV_ICON[key]} size={16} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* 侧栏宽 224px：带区服的完整形态放不下（区服会被截断），
              因此与移动端头部一致用 `compact` —— 只显示账号名，区服信息在「设置 · 账号」里看 */}
          <div className="mt-auto rounded-md border border-line-soft bg-surface-2 px-2.5 py-2">
            {/* label 与切换器**同一行**：竖排两行在 224px 宽的卡片里既空又多占一行高度 */}
            <div className="flex items-center justify-between gap-2">
              <p className="flex-none text-sm text-ink-3">当前账号</p>
              <ProfileSwitcher direction="up" compact />
            </div>
            {/* 下一个结界卡收/续点；没有进行中的任务时组件自己返回 null，不留空隙 */}
            <NurtureBadge className="mt-2" />
          </div>
        </div>

        <OfudaDeco />
      </aside>

      <main className="flex-1 overflow-y-auto">
        {/* 内容区上限（1024）与整体框架在这里；窄页（统计 768 / 工具 896 / 设置 672）
            各自 `mx-auto` 让内容在大屏居中，不由这一层替它们居中 */}
        <div className="mx-auto max-w-5xl">
          <NavContent variant="desktop" />
        </div>
      </main>
    </div>
  );
}
