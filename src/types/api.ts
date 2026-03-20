import { z } from 'zod/v4';
import { ARTIFACT_RETRY_SOURCES, type PersistedChatParts } from '@/types/chat';

// ─── Chat ───
export const chatBodySchema = z.object({
  conversationId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1),
        role: z.enum(['user', 'assistant']),
        parts: z.array(z.unknown()),
        metadata: z.unknown().optional(),
      }),
    )
    .min(1),
  artifactRetry: z
    .object({
      assistantMessageId: z.string().min(1),
      artifactToolCallId: z.string().min(1),
      artifactTitle: z.string().nullable(),
      artifactDescription: z.string().nullable(),
      files: z.record(z.string(), z.string()).nullable(),
      error: z.string().min(1),
      source: z.enum(ARTIFACT_RETRY_SOURCES),
      attempt: z.number().int().positive(),
      manual: z.boolean(),
    })
    .optional(),
});
export type ChatBody = z.infer<typeof chatBodySchema>;

export const createConversationBodySchema = z.object({
  initialMessage: z.string().trim().min(1).max(4000).optional(),
});
export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;

// ─── Upload ───
export interface UploadResponse {
  readonly fileId: string;
  readonly fileName: string;
  readonly blobUrl: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly preview: readonly Record<string, unknown>[];
  readonly truncated: boolean;
}

// ─── Conversations ───
export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface ConversationDetailResponse {
  readonly conversation: ConversationSummary;
  readonly messages: readonly MessageResponse[];
  readonly files: readonly FileMetadataResponse[];
}

export interface MessageResponse {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly parts: PersistedChatParts;
  readonly createdAt: string;
}

export interface FileMetadataResponse {
  readonly id: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
}
