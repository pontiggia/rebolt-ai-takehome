import { StaticFileChip } from '@/components/chat/file-chip';
import type { FileUploadBadgeProps } from '@/types/components';

export function FileUploadBadge({ fileName, fileType }: FileUploadBadgeProps) {
  return <StaticFileChip fileName={fileName} fileType={fileType} />;
}
