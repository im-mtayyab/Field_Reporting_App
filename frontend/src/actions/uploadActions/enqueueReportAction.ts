import {
  createRemoteReportEarly,
  enqueueReport,
  prepareReportAttachments,
  processQueue,
} from '../../uploadQueue';
import type { FormImage } from '../../screens/CreateScreen/createReportForm.schema';
import { toAppError } from '../result';

export type EnqueueReportActionResult =
  | { ok: true; reportId: string; remoteCreated: boolean }
  | { ok: false; message: string };

/**
 * Persists the report locally, registers it on the server when reachable,
 * then continues photo preparation and upload in the background.
 */
export async function enqueueReportAction(input: {
  description: string;
  images: FormImage[];
  onPhase?: (message: string) => void;
}): Promise<EnqueueReportActionResult> {
  try {
    input.onPhase?.('Saving report on this device…');
    const report = await enqueueReport({
      description: input.description,
      images: input.images,
    });

    input.onPhase?.('Registering report on the server…');
    let remoteCreated = false;
    try {
      remoteCreated = await createRemoteReportEarly(report.id);
    } catch {
      remoteCreated = false;
    }

    void (async () => {
      try {
        await prepareReportAttachments(report.id);
        await processQueue();
      } catch {
        try {
          await processQueue();
        } catch {
          // Connectivity and app-lifecycle handlers retry the queue later.
        }
      }
    })();

    return { ok: true, reportId: report.id, remoteCreated };
  } catch (error) {
    const appError = toAppError(error);
    return {
      ok: false,
      message:
        appError.message ||
        'The report could not be saved on this device. Please try again.',
    };
  }
}
