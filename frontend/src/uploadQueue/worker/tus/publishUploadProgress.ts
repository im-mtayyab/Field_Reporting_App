import { notifyUploadProgress } from '../../../services/notifyService';
import { useUploadProgress } from '../../../store/uploadProgress';

export function publishUploadProgress(
  attachmentId: string,
  fileName: string,
  bytesUploaded: number,
  bytesTotal: number,
): void {
  useUploadProgress
    .getState()
    .setProgress(attachmentId, bytesUploaded, bytesTotal);
  notifyUploadProgress(attachmentId, fileName, bytesUploaded, bytesTotal);
}
