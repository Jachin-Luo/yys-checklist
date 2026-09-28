/**
 * **id 生成** —— 与 `schema/item.schema.json`、`tools/build.js`、`domain/itemPatch`
 * 共用同一枚尺子：只允许 `[a-z0-9_]`。
 *
 * ## 为什么必须收口到一个文件（2026-09-28 修一个真 bug）
 *
 * 此前表单（`ItemForm`）与 Mock（`api/mock/adapter`）各自写 `nanoid(6)`，
 * 而 nanoid 的默认字母表是 `A-Za-z0-9_-` —— 生成出来的 id **约 96% 含大写或 `-`**，
 * 全部不符合 id 规则。命中的是"新加的子步骤"：
 *
 *   - 写：14 步原样落进分片（`updateItem` 返回 14 步，看着是成功了）；
 *   - 读：`itemPatch.sanitizeChildren` 只收合法 id，把 11 个新 id 悄悄丢掉，
 *     合并出来的有效条目**还是原来那 3 步**；
 *   - 用户看到的就是"我在条目管理里改成 14 个子条目，没生效"。
 *
 * 静默丢数据比报错更糟，而它的根因是**规则分散在三处、生成器分散在两处** ——
 * 所以生成器收口到这里，并由单测锁住"生成出来的 id 一定合法"。
 */
import { customAlphabet } from 'nanoid';

/** 与 `schema/item.schema.json` 里 `id.pattern` 逐字相同的字符集 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789_';

/* 8 位：与原先 nanoid(6) 同一量级，撞车概率足够低；id 只在本机分片里做键，不需要全局唯一 */
const gen = customAlphabet(ALPHABET, 8);

/**
 * 生成 id：`custom_xxxxxxxx` / `sub_xxxxxxxx`。
 * 前缀由调用方给 —— 它表达"这是什么"，是给人读的那部分。
 */
export const newId = (prefix: string): string => `${prefix}_${gen()}`;
