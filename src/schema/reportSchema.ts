/**
 * 聚合阶段（阶段二）AI 输出的格式约束，双份定义：
 *
 * 1. zod schema —— 运行时校验（容忍缺省，配合 .default()）
 * 2. AGGREGATE_JSON_SCHEMA —— 发给 API 的 strict json_schema
 *    （OpenAI strict 模式硬性要求：所有字段 required、additionalProperties: false；
 *      可缺省语义由 zod 的 .default() 在客户端兜底）
 *
 * ⚠️ 两份定义必须同步维护：字段增删时两边都要改。
 */

import { z } from "zod";

// ===== 1. zod schema =====

/** AI 返回的原始证据引用（quote 由 AI verbatim 摘录并翻译，链接不由 AI 生成） */
export const rawEvidenceZod = z.object({
  post_id: z.string().min(1),
  comment_id: z.string().min(1).nullable(),
  quote_en: z.string().min(1),
  quote_zh: z.string().min(1),
});

/** 阶段二：一条需求信号（importance/satisfaction 为 0-10 整数，freq/opportunity 前端算） */
export const signalZod = z.object({
  name: z.string().min(1),
  importance: z.number().int().min(0).max(10),
  satisfaction: z.number().int().min(0).max(10),
  willingness: z.string().min(1),
  current: z.string().default(""),
  flaw: z.string().default(""),
  competition: z.string().min(1),
  angle: z.string().default(""),
  emotion: z.enum(["negative", "mixed", "positive"]),
  post_ids: z.array(z.string()).default([]),
  quotes: z.array(rawEvidenceZod).default([]),
  cur_quotes: z.array(rawEvidenceZod).default([]),
});

/** 阶段二聚合输出（对 AI 宽容：数组缺省按空处理） */
export const aggregateZod = z.object({
  signals: z.array(signalZod).default([]),
});

export type AggregateResponse = z.infer<typeof aggregateZod>;

/** 阶段一抽取的原子条目类型 */
export const extractionItemZod = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("need"),
    text: z.string().min(1),
    emotion: z.enum(["negative", "mixed", "positive"]),
    post_id: z.string().min(1),
    comment_id: z.string().nullable(),
    quote_en: z.string().min(1),
  }),
  z.object({
    type: z.literal("workaround"),
    text: z.string().min(1),
    solution: z.string().min(1),
    drawback: z.string().default(""),
    post_id: z.string().min(1),
    comment_id: z.string().nullable(),
    quote_en: z.string().min(1),
  }),
]);

/** 阶段一抽取输出（包一层 items 兼容裸数组/包裹对象两种返回） */
export const extractionZod = z.object({
  items: z.array(extractionItemZod).default([]),
});

export type ExtractionResponse = z.infer<typeof extractionZod>;

// ===== 2. JSON Schema（发给 API 的 strict json_schema） =====

const rawEvidenceDef = {
  type: "object",
  properties: {
    post_id: { type: "string" },
    comment_id: { type: ["string", "null"] },
    quote_en: { type: "string" },
    quote_zh: { type: "string" },
  },
  required: ["post_id", "comment_id", "quote_en", "quote_zh"],
  additionalProperties: false,
} as const;

const signalDef = {
  type: "object",
  properties: {
    name: { type: "string" },
    importance: { type: "integer", minimum: 0, maximum: 10 },
    satisfaction: { type: "integer", minimum: 0, maximum: 10 },
    willingness: { type: "string" },
    current: { type: "string" },
    flaw: { type: "string" },
    competition: { type: "string" },
    angle: { type: "string" },
    emotion: { type: "string", enum: ["negative", "mixed", "positive"] },
    post_ids: { type: "array", items: { type: "string" } },
    quotes: { type: "array", items: { $ref: "#/$defs/raw_evidence" } },
    cur_quotes: { type: "array", items: { $ref: "#/$defs/raw_evidence" } },
  },
  required: [
    "name",
    "importance",
    "satisfaction",
    "willingness",
    "current",
    "flaw",
    "competition",
    "angle",
    "emotion",
    "post_ids",
    "quotes",
    "cur_quotes",
  ],
  additionalProperties: false,
} as const;

/** 聚合阶段的 strict json_schema，字段与 aggregateZod 一一对应 */
export const AGGREGATE_JSON_SCHEMA = {
  name: "voc_signals",
  strict: true,
  schema: {
    type: "object",
    $defs: {
      raw_evidence: rawEvidenceDef,
    },
    properties: {
      signals: { type: "array", items: signalDef },
    },
    required: ["signals"],
    additionalProperties: false,
  },
} as const;

const extractionNeedDef = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["need"] },
    text: { type: "string" },
    emotion: { type: "string", enum: ["negative", "mixed", "positive"] },
    post_id: { type: "string" },
    comment_id: { type: ["string", "null"] },
    quote_en: { type: "string" },
  },
  required: ["type", "text", "emotion", "post_id", "comment_id", "quote_en"],
  additionalProperties: false,
} as const;

const extractionWorkaroundDef = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["workaround"] },
    text: { type: "string" },
    solution: { type: "string" },
    drawback: { type: "string" },
    post_id: { type: "string" },
    comment_id: { type: ["string", "null"] },
    quote_en: { type: "string" },
  },
  required: ["type", "text", "solution", "drawback", "post_id", "comment_id", "quote_en"],
  additionalProperties: false,
} as const;

/** 抽取阶段的 strict json_schema，字段与 extractionZod 一一对应 */
export const EXTRACTION_JSON_SCHEMA = {
  name: "voc_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          anyOf: [extractionNeedDef, extractionWorkaroundDef],
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
} as const;
