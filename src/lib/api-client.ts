import type { FilePreviewResponse, UploadResponse } from '@/types/api';

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Response body wasn't JSON
  }
  return fallback;
}

export async function uploadFile(conversationId: string | null, file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) {
    formData.append('conversationId', conversationId);
  }

  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Upload failed'));
  }

  return res.json() as Promise<UploadResponse>;
}

export async function fetchFilePreview(fileId: string, signal?: AbortSignal): Promise<FilePreviewResponse> {
  const res = await fetch(`/api/files/${fileId}/preview`, { signal });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to load file preview'));
  }

  return res.json() as Promise<FilePreviewResponse>;
}
