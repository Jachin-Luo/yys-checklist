# 新版本条目录入门架（K6 / S1.5 ⑤）

版本更新时按此流程录入，**目标是「宁可少而准，不要多而错」**。

> 完整规范（字段逐个说明、收益口径、子步骤写法、踩过的坑）见 `docs/06-limited-intake.md`。

## 0. 前置

1. 更新 `src/db/limited.db.json` 里当期版本的条目（2026-09-28 起版本活动与限时活动同属 `limited`，没有单独的版本周期）；
2. 活动结束的条目填 `until`（到期自动归档下线）—— 合并后**不再有"随版本锚点自动翻篇"**这回事，翻篇只能靠 `until`。

> 旧的 `meta.periods` 锚点机制已随周期合并整体删除，别再去找它。

## 1. 录入清单

| 步骤 | 动作 | 校验点 |
|---|---|---|
| ① 归档 | 上一版本条目：确认 `until` 已过，或补上 `until` | `npm run db:check` 无「应归档」提示 |
| ② 新增 | 复制下方模板到 `src/db/limited.db.json` 的 `items` 数组（版本活动条目属 `limited`） | `id` 唯一、`^[a-z0-9_]+$` |
| ③ 枚举 | `cycle` / `gainKind` 只能取 `src/domain/enums.ts` 中的值 | 双轨校验通过 |
| ④ 时间 | 活动类填 `start` + `deadline`（+`until`）；日常类填 `time` + `timeEnd` | `deadline ≥ start`、`timeEnd > time` |
| ⑤ 收益 | 只填**保底固定值**；浮动的只标 `gainKind` 不填 `gain` | `gain` 与 `gainKind` 对应关系校验 |
| ⑥ 校验 | `npm run db:check` | **0 错误** |
| ⑦ 校准 | `npm run db:calibrate` 导出待核清单 | 新增的存疑项已登记 |

## 2. 条目模板

```jsonc
{
  "id": "ltd_xxx_yyy",
  "name": "（新条目名，2–24 字）",
  "cycle": "limited",
  "path": "（入口路径，≤40 字）",
  "gainKind": [
    "jade",
    "blueTicket"
  ],
  "gainNote": "（口径说明，≤40 字；浮动收益写「不计入固定收益」）",
  "condition": "（触发条件，可选）",
  "time": "20:00",
  "timeEnd": "21:00",
  "start": "2026-09-09",
  "deadline": "2026-10-06 23:59",
  "until": "2026-10-07",
  "note": "（提醒备注，≤60 字；只写玩家可见的事实）",
  "origin": "preset"
}
```

## 3. 字段红线

- `value`（S/A/B/C）/ `time2` / `source` **已删除**，不得再录入；
- 一天两次的条目**必须拆成两条**（如 `xxx_am` / `xxx_pm`），两条 `gain` 之和须等于原条目总量；
- `gainKind` **必须逐条人工指定**，禁止用正则从任何文本字段推断（Q14 纪律；`reward` 字段已于 2026-09-11 删除）；
- `until` ≠ `deadline`：前者是「从清单下线」，后者是「活动截止仍要提示」；
- `note` / `condition` **只写玩家可见的事实**，不写维护口径（步数怎么算出来的、改在哪个界面、依据哪篇攻略、这条什么时候由谁删）。用户会在清单卡片上逐字读到它们；「子步骤 = 剩余可做次数（自 9/28 起 3 次，可在「条目管理」里改）」这类话 2026-09-29 已从 `limited.db.json` 清理，录入时别再写回来。
