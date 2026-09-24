/**
 * 菱形符格（共享勾选原子件）。
 *
 * ## 2026-09-23 由「圆形勾选框」改为「菱形符格」
 *
 * 上一版是绿底白勾的圆框，与朱印语言冲突：参考稿的四条铁律里，
 * **绿色不在三色之内**，且"已完成"的正确表达是**主动降饱和沉下去**
 * （朱红划除线 + 卡片沉降），而不是亮一个更醒目的绿点。
 *
 * 现在：未勾 = 金描边空心菱形；已勾 = 朱红实心菱形。
 * 用「方块 + rotate(45deg)」而不是画菱形 path —— 交互态（悬停 / 过渡）更好做，
 * 这也是参考稿自己选的做法。
 *
 * 语义控件仍是 `<button>`：可聚焦、可键盘操作、带 `aria-pressed`。
 * 卡片整张可点只是把命中区放大，不替代这个控件。
 */
interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: 'md' | 'sm';
}

export default function CheckBox({ checked, onToggle, label, size = 'md' }: Props) {
  /* 2026-09-24 册页重设计：md 档缩小一档（20 → 18px）—— 账目行密度上来之后，
     行首的勾选框过大反而成了视觉锚点（用户反馈"菱形勾选框的大小可以变小一些"）；
     触控热区由整行承担，符号格本身退成指示器 */
  const box = size === 'md' ? 'h-4.5 w-4.5' : 'h-4 w-4';
  const mark = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`group flex flex-none cursor-pointer items-center justify-center ${box}`}
    >
      <i
        className={`block rotate-45 border transition-colors duration-220 ease-genso ${mark} ${
          checked
            ? 'border-crimson bg-crimson'
            : 'border-gold bg-transparent group-hover:bg-gold-soft'
        }`}
      />
    </button>
  );
}
