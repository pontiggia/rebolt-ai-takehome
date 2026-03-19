import { z } from 'zod/v4';

// ─── Chat ───
export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ),
  conversationId: z.string().uuid(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

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
  readonly createdAt: string;
}

export interface FileMetadataResponse {
  readonly id: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
}
