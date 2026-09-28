import { useMemo } from 'react';
import Icon from '../../components/icons/Icon';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { btn, input, tx } from '../../components/common/controls';
import { isValidHm, guildTimeTargets, configuredCount } from '../../domain/guildTime';
import { useDevicePrefs } from '../../hooks/useDevicePrefs';
import { useGuildTimeStore } from '../../stores/guildTime';
import { useItemStore } from '../../stores/items';

/* 时间输入框：走配方（`controls.input`）+ 等宽变体（时刻用等宽，位数才对得齐）。
   ⚠️ 宽度由**外面那层 `w-28` 的 span** 给，不能写在这个元素上 —— `input.base` 自带 `w-full`，
   两个宽度类同属性、由 Tailwind 的生成顺序决胜，写在后面也不一定赢（见调用点注释） */
const inputCls = `${input.base} ${input.md} ${input.num}`;

/* 行内小按钮：走 `btn` 配方的小号档（原先本文件自己拼 `px-2 py-1 text-sm`，
   与「清空记录」「关于」里走配方的同款差着一档字号 —— 见 `controls.tx` 的说明） */
const smallBtn = `${btn.base} ${btn.sm} ${btn.out}`;

/**
 * 「设置 · 寮时间」分区（需求 §5-D3 / D3 难点）。
 *
 * 道馆 / 宴会 / 首领退治 / 狭间暗域等集体活动的时间**各寮自定，写死即错**，
 * 所以数据里的 `time` 只是参考值，用户配置的值在展示层叠加（`domain/guildTime.applyGuildTime`）。
 *
 * **2026-09-16 改为账号级**（`yys:guild:{profileId}`）：原设计存在设备级键里、
 * "换号不用重配"，但那只对"所有号都在自己寮"成立。现在每个号各有一份，
 * 需要多号共用时走下面的「同步到其他账号」。
 *
 * 卡内分割：说明文字在上（配置前提），逐条录入在下（明细）。
 */
export default function GuildTimeSection() {
  const items = useItemStore((s) => s.items);
  const guildTime = useGuildTimeStore((s) => s.guildTime);
  const setGuildTime = useGuildTimeStore((s) => s.setGuildTime);
  const clearGuildTime = useGuildTimeStore((s) => s.clearGuildTime);
  /* 引导标记仍是设备级：它是"这台设备看过引导没有"，与哪个账号无关 */
  const { resetOnboarding } = useDevicePrefs();

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
          onClick={() => void clearGuildTime()}
          className={smallBtn}
        >
          <Icon name="trash" size={12} />
          清空配置
        </button>
      }
    >

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
                <Icon name="tokei" size={13} className="mt-1 flex-none text-ink-4" />
                <span className={`min-w-0 break-words ${tx.rowName} text-ink`}>{it.name}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                {/* 定宽给外壳：`input.base` 自带 `w-full` */}
                <span className="w-28 flex-none">
                  <input
                    type="time"
                    aria-label={`${it.name} 的寮时间`}
                    value={value}
                    onChange={(e) => void setGuildTime(it.id, e.target.value)}
                    className={inputCls}
                  />
                </span>
                {value ? (
                  <button
                    type="button"
                    onClick={() => void setGuildTime(it.id, '')}
                    className={smallBtn}
                  >
                    清除
                  </button>
                ) : null}
                {invalid ? <span className={`${tx.message} text-danger`}>格式应为 HH:mm</span> : null}
              </div>
              <span className={`col-span-2 min-w-0 break-words ${tx.note} text-ink-3`}>
                参考 {it.time ?? '—'}
                {it.timeNote ? ` · ${it.timeNote}` : ''}
              </span>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => resetOnboarding()}
          className={`mt-2 ${smallBtn}`}
        >
          重看冷启动引导
        </button>
      </div>
    </CollapsibleSection>
  );
}
