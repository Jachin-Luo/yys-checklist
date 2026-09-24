/**
 * 分段控件（参考稿 §10 `.seg`，2026-09-24 圆润版）：
 * **胶囊外轨**（`fill-2` 底 + 弱金线）包着几颗胶囊段，选中段 = 朱红渐变实心 + 暖白字。
 * 上一版是"方角外框 + 选中段卡底描边"（方正语言）；圆润版把外轨与段都做成全圆，
 * 选中态也从"描边"升级为"实心"——同一屏里分段是最高频的切换控件，值得一个实心锚点。
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
      className="inline-flex flex-none gap-0.5 rounded-full border border-line bg-fill-2 p-1"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`h-7 cursor-pointer rounded-full px-3.5 text-sm transition-colors duration-150 ease-genso ${
              on
                ? 'bg-gradient-to-b from-crimson-hi to-crimson text-on-crimson shadow-cta'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
