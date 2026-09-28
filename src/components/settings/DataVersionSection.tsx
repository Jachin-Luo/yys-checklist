import Icon from '../icons/Icon';
import CollapsibleSection from '../common/CollapsibleSection';
import { tx } from '../common/controls';
import { dataFreshness } from '../../domain/backup';
import { useItemStore } from '../../stores/items';

/**
 * 「设置 · 数据版本」（设计文档 §4.1 / §9 S7）。
 *
 * §4.1 把 `dataVersion` 的 UI 定位定为「**可选展示**」（需求 Q10：校核后再上 UI，
 * "防静默过期"是目标而非本期硬要求）。这里按"可选但有用"来做：
 * 把快照版本、结构版本、更新日、周期重置规则集中在一处 ——
 * 用户遇到"活动日期不对"时，第一个要确认的就是这组信息。
 *
 * **只提示、不阻断**：数据过期不等于功能坏了，旧快照照样能记录，只是要提醒以游戏内为准。
 *
 * 2026-09-23 随设置页重构：曾由折叠卡改为**平铺设置行**（"能一行说完的平铺"）。
 * 2026-09-28 **改回折叠**（用户要求：默认收起来，"没什么展示的必要"）——
 * 它是**只读的排障信息**（版本号 / 快照日期 / 重置规则），平时不需要占据一屏，
 * 只有"活动日期不对"时才要展开核对。收起后关键结论仍在 `summary` 里：
 * 版本号 + 新鲜度（过期时带"可能已过期"），不展开也知道要不要管它。
 * 展开后是 `<dl>` 键值表 —— 这本来就是一组"名 / 值"。
 */
export default function DataVersionSection() {
  const meta = useItemStore((s) => s.meta);
  if (!meta) return null;

  const fresh = dataFreshness(meta.updated);

  /* 2026-09-28 起不再有「版本锚点 / 赛季锚点」两行：那两个周期已并入 `limited`，
     锚点机制整体退场（见 `domain/enums` 的说明），这里没有可展示的锚点了 */
  const rows: Array<{ label: string; value: string; hint?: string; warn?: boolean }> = [
    { label: '数据快照', value: meta.dataVersion, hint: '随包发布的条目库快照，本期不做热更新' },
    { label: '数据结构版本', value: meta.version, hint: '备份文件的 schemaVersion 与它比对' },
    { label: '快照更新日', value: meta.updated, hint: fresh.text, warn: fresh.stale },
    {
      label: '周期重置',
      value: `每日 ${String(meta.resetHour).padStart(2, '0')}:00`,
      hint: meta.resetNote,
    },
  ];

  return (
    <CollapsibleSection
      title="数据版本"
      aside={<span className={`${tx.note} text-ink-3`}>只读</span>}
      summary={
        fresh.stale
          ? `${meta.dataVersion} · ${fresh.text}（可能已过期）`
          : `${meta.dataVersion} · ${fresh.text}`
      }
    >
      <div className="px-3 py-3">
        {/* 只读数据表（册页稿 `.dlist`）：键定宽在左（132px 档）、值等宽在右，
            行间只有一条 faint 细线 —— 它不是可操作列表，不卡片化 */}
        <dl>
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline gap-3.5 border-b border-line-faint py-2 last:border-0"
            >
              <dt className={`w-32 flex-none ${tx.label} text-ink-2`}>{r.label}</dt>
              <dd className="min-w-0 flex-1">
                {/* 版本号 / 日期 / 时刻一律等宽：同一份信息在不同行之间对齐才好核对 */}
                <span className={`block break-all ${tx.mono} text-ink-2`}>{r.value}</span>
                {r.hint ? (
                  <small className={`mt-0.5 block ${tx.note} ${r.warn ? 'text-warn' : 'text-ink-3'}`}>
                    {r.hint}
                  </small>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        {fresh.stale ? (
          <p className={`mt-2 flex items-start gap-1.5 ${tx.message} text-warn`}>
            <Icon name="makimono" size={12} className="mt-0.5 flex-none" />
            数据快照已超过 {fresh.days} 天未更新，活动时间与掉落可能已变化 —— 以游戏内说明为准。
          </p>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}
