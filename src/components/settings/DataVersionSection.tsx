import Icon from '../icons/Icon';
import SettingRow from '../common/SettingRow';
import { dataFreshness } from '../../domain/backup';
import { useItemStore } from '../../stores/items';

/**
 * 「设置 · 数据版本」（设计文档 §4.1 / §9 S7）。
 *
 * §4.1 把 `dataVersion` 的 UI 定位定为「**可选展示**」（需求 Q10：校核后再上 UI，
 * "防静默过期"是目标而非本期硬要求）。这里按"可选但有用"来做：
 * 把快照版本、结构版本、更新日、周期重置规则、版本/赛季锚点集中在一处 ——
 * 用户遇到"活动日期不对"时，第一个要确认的就是这组信息。
 *
 * **只提示、不阻断**：数据过期不等于功能坏了，旧快照照样能记录，只是要提醒以游戏内为准。
 *
 * 2026-09-23 随设置页重构：由折叠卡改为**平铺设置行**（用户决策：能一行说完的平铺）。
 * 键值明细挂在行下方（`SettingRow` 的 children）—— 它们与标题同属一个信息单元，
 * 拆成两张卡会被误读成两件独立的事。语义上改用 `<dl>`：这本来就是一组"名 / 值"。
 */
export default function DataVersionSection() {
  const meta = useItemStore((s) => s.meta);
  if (!meta) return null;

  const fresh = dataFreshness(meta.updated);
  const periods = [
    { label: '版本锚点', anchor: meta.periods.version },
    { label: '赛季锚点', anchor: meta.periods.season },
  ];

  const rows: Array<{ label: string; value: string; hint?: string; warn?: boolean }> = [
    { label: '数据快照', value: meta.dataVersion, hint: '随包发布的条目库快照，本期不做热更新' },
    { label: '数据结构版本', value: meta.version, hint: '备份文件的 schemaVersion 与它比对' },
    { label: '快照更新日', value: meta.updated, hint: fresh.text, warn: fresh.stale },
    {
      label: '周期重置',
      value: `每日 ${String(meta.resetHour).padStart(2, '0')}:00`,
      hint: meta.resetNote,
    },
    ...periods.flatMap(({ label, anchor }) => anchor ? [{
      label,
      value: `${anchor.key} · ${anchor.startAt.replace('T', ' ')}`,
      hint: anchor.note,
    }] : []),
  ];

  return (
    <SettingRow
      title="数据版本"
      desc={fresh.stale ? `${meta.dataVersion} · ${fresh.text}（可能已过期）` : `${meta.dataVersion} · ${fresh.text}`}
      control={<span className="text-sm text-ink-3">只读</span>}
    >
      <dl className="border-t border-line-faint">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-start gap-3 border-b border-line-faint py-2 last:border-0"
          >
            <dt className="min-w-0 flex-1 text-base text-ink">
              {r.label}
              {r.hint ? (
                <small className={`mt-0.5 block text-sm font-normal ${r.warn ? 'text-warn' : 'text-ink-3'}`}>
                  {r.hint}
                </small>
              ) : null}
            </dt>
            {/* 版本号 / 日期 / 时刻一律等宽：同一份信息在不同行之间对齐才好核对 */}
            <dd className="flex-none text-right font-mono text-sm text-ink-2">{r.value}</dd>
          </div>
        ))}
      </dl>

      {fresh.stale ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-warn">
          <Icon name="fumi" size={12} className="mt-0.5 flex-none" />
          数据快照已超过 {fresh.days} 天未更新，活动时间与掉落可能已变化 —— 以游戏内说明为准。
        </p>
      ) : null}
    </SettingRow>
  );
}
