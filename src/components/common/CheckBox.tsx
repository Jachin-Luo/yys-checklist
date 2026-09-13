import { Check } from 'lucide-react';

/**
 * 圆形勾选框（共享原子件）。完成态绿底白勾，符合"完成态一目了然"（需求 §5-D2）。
 * 用 `<button>` 而非 div —— 可聚焦、可键盘操作。
 */
interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: 'md' | 'sm';
}

export default function CheckBox({ checked, onToggle, label, size = 'md' }: Props) {
  const box = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={[
        'flex flex-none cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors duration-120',
        box,
        checked
          ? 'border-success bg-success text-white'
          : 'border-line bg-surface text-transparent hover:border-ink-4',
      ].join(' ')}
    >
      <Check size={size === 'md' ? 12 : 10} strokeWidth={3} className={checked ? '' : 'invisible'} />
    </button>
  );
}
