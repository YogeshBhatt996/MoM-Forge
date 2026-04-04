import { z } from "zod";

const NOT_SPECIFIED = "Not specified in transcript";

const fallback = (schema: z.ZodString) =>
  schema.optional().default(NOT_SPECIFIED);

export const attendeeSchema = z.object({
  name: fallback(z.string()),
  role: fallback(z.string()),
  organization: fallback(z.string()),
});

export const actionItemSchema = z.object({
  action: fallback(z.string()),
  owner: z
    .string()
    .optional()
    .default("Owner not clearly identified in transcript"),
  due_date: fallback(z.string()),
  status_remarks: fallback(z.string()),
});

export const discussionPointSchema = z.object({
  topic: fallback(z.string()),
  summary: fallback(z.string()),
  decisions: z.array(z.string()).optional().default([]),
});

export const momDataSchema = z.object({
  meeting_title: fallback(z.string()),
  meeting_date: fallback(z.string()),
  meeting_time: fallback(z.string()),
  location_or_platform: fallback(z.string()),
  facilitator: fallback(z.string()),
  attendees: z.array(attendeeSchema).optional().default([]),
  agenda_items: z.array(z.string()).optional().default([]),
  discussion_summary: z.array(discussionPointSchema).optional().default([]),
  action_items: z.array(actionItemSchema).optional().default([]),
  next_meeting: z
    .object({
      date: fallback(z.string()),
      time: fallback(z.string()),
      agenda: fallback(z.string()),
    })
    .optional()
    .default({
      date: NOT_SPECIFIED,
      time: NOT_SPECIFIED,
      agenda: NOT_SPECIFIED,
    }),
  additional_notes: fallback(z.string()),
});

export type MoMDataInput = z.input<typeof momDataSchema>;
