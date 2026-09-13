import { useMemo } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { isValidHm, guildTimeTargets, configuredCount } from '../../domain/guildTime';
import { useDevicePrefs } from '../../hooks/useDevicePrefs';
import { useItemStore } from '../../stores/items';

/* 去掉 `outline-none`，焦点环交给 `styles/base.css` 的全局 `:focus-visible` */
const inputCls =
  'w-28 flex-none rounded-sm border border-line bg-surface px-2 py-1 text-lg text-ink transition-colors duration-120 focus:border-brand';

/**
 * 「我的 · 寮时间」分区（需求 §5-D3 / D3 难点）。
 *
 * 道馆 / 宴会 / 首领退治 / 狭间暗域等集体活动的时间**各寮自定，写死即错**，
 * 所以数据里的 `time` 只是参考值，用户配置的值在展示层叠加（`domain/guildTime.applyGuildTime`）。
 * 配置存在设备级键 `yys:guildTime` —— 换号不用重配，换手机才需要。
 *
 * 卡内分割：说明文字在上（配置前提），逐条录入在下（明细）。
 */
export default function GuildTimeSection() {
  const items = useItemStore((s) => s.items);
  const { guildTime, setGuildTime, clearGuildTime, resetOnboarding } = useDevicePrefs();

  const targets = useMemo(() => guildTimeTargets(items), [items]);
  const done = configuredCount(items, guildTime);

  return (
    <CollapsibleSection
      title="寮时间"
      summary={`已配置 ${done} / ${targets.length} 项 · 集体活动各寮自定`}
      aside={
        <button
          type="button"
          disabled={done === 0}
          onClick={() => clearGuildTime()}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={12} strokeWidth={2} />
          清空配置
        </button>
      }
    >
      <div className="bg-surface-3 px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-3">
          集体活动的时间由所在寮决定，官方无法统一代班。填入你的寮实际时间后，
          清单里的时间徽章会按你配置的时刻提示「未开始 / 进行中 / 已结束」。
        </p>
      </div>

      <div className="px-3 py-3">
        {targets.map((it) => {
          const value = guildTime[it.id] ?? '';
          const invalid = value !== '' && !isValidHm(value);
          return (
            <div
              key={it.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-line-faint px-1 py-2 last:border-0"
            >
              <div className="flex min-w-0 items-start gap-2 py-1">
                <Clock size={13} className="mt-1 flex-none text-ink-4" />
                <span className="min-w-0 break-words text-lg text-ink">{it.name}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <input
                  type="time"
                  aria-label={`${it.name} 的寮时间`}
                  value={value}
                  onChange={(e) => setGuildTime(it.id, e.target.value)}
                  className={inputCls}
                />
                {value ? (
                  <button
                    type="button"
                    onClick={() => setGuildTime(it.id, '')}
                    className="cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
                  >
                    清除
                  </button>
                ) : null}
                {invalid ? <span className="text-sm text-danger">格式应为 HH:mm</span> : null}
              </div>
              <span className="col-span-2 min-w-0 break-words text-sm leading-relaxed text-ink-3">
                参考 {it.time ?? '—'}
                {it.timeNote ? ` · ${it.timeNote}` : ''}
              </span>
            </div>
          );
        })}

        <p className="mt-2.5 text-sm text-ink-3">
          配置保存在本机（设备级），换号不用重配；换设备需要重新配置。
        </p>
        <button
          type="button"
          onClick={() => resetOnboarding()}
          className="mt-2 cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
        >
          重看冷启动引导
        </button>
      </div>
    </CollapsibleSection>
  );
}
