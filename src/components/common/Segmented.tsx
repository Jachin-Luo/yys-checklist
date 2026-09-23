/**
 * 分段控件（参考稿 §7 控件规格）：
 * 外框弱金线 + 浅块底，选中段 = 卡底 + 金描边 + 金字。
 *
 * 抽成组件而不是在设置页里各写一份：界面主题（明版 / 暗版）与卡片字段预设（极简 / 简要 / 完整）
 * 是同一类"少量互斥选项、立即生效"的控件，两处样式一旦分头维护就会慢慢长歪。
 *
 * `value` 传 `null` 表示**当前值不属于任何一项**（如卡片字段被逐项改过、不再匹配任何预设）——
 * 此时所有段都不高亮，而不是把第一段误标成选中。这是刻意的：
 * 把"自定义"错显示成某个预设，正是这个功能最容易误导人的地方。
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  /** 供读屏识别的组名（视觉上不显示） */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-none gap-0.5 rounded-sm border border-line-soft bg-surface-3 p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-sm px-2.5 py-1 text-sm transition-colors duration-120 ${
              on ? 'bg-surface text-gold-hi ring-1 ring-line' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
