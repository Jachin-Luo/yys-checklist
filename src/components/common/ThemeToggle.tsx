import Icon from '../icons/Icon';
import { useThemeStore } from '../../stores/theme';

/**
 * 明暗切换（符纸签造型，参考稿的 `.tbtn`）。
 *
 * 文案 / 图标显示的都是**将要切到的那一版**（现在是明版 → 显示月亮"暗版"），
 * 与参考稿一致：按钮上写目标，用户不用先想"现在是什么"。悬停时菱形转 90° ——
 * 仪式感押给转场，静态层只留最轻的一笔。
 *
 * ## `compact`：移动端顶栏只用图标（2026-09-23 用户要求）
 *
 * 移动端顶栏一行要放"标题 + 明暗 + 账号"，两个文字按钮会把标题挤到换行；
 * 而**明暗是低风险高频操作，账号是高风险管理操作**（切错号会勾错号，这是本产品最容易犯的错）——
 * 于是让标题与账号保留文字，明暗退成纯图标。
 *
 * 代价是图标本身语义弱（日月是通用隐喻，但"点它会变哪一版"看不出来），
 * 所以 `title` + `aria-label` 必须写全 —— 这两个属性在只有图标时不再是"锦上添花"，
 * 而是唯一的语义出口（读屏与长按提示都靠它）。
 */
export default function ThemeToggle({
  className = '',
  compact = false,
}: {
  className?: string;
  /** 纯图标形态（移动端顶栏用） */
  compact?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const next = theme === 'dark' ? '明版' : '暗版';

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        title={`切换到${next}`}
        aria-label={`切换到${next}`}
        className={`flex flex-none cursor-pointer items-center justify-center rounded-sm border border-line p-1.5 text-gold transition-colors duration-120 hover:border-gold-hi hover:bg-gold-soft hover:text-gold-hi ${className}`}
      >
        {/* 要切到暗版 → 显示月亮；要切到明版 → 显示太阳 */}
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={`切换到${next}`}
      aria-label={`切换到${next}`}
      className={`group flex flex-none cursor-pointer items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-2xs tracking-wide text-gold transition-colors duration-120 hover:border-gold-hi hover:bg-gold-soft hover:text-gold-hi ${className}`}
    >
      <Icon name="rhomb" size={8} className="transition-transform duration-300 group-hover:rotate-90" />
      {next}
    </button>
  );
}
