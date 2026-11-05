import { buildTusUploadMetadata } from './tusMetadata';

export type CreateTusLocationInput = {
  uploadEndpoint: string;
  accessToken: string;
  apikey: string;
  bucket: string;
  objectPath: string;
  contentType: string;
  sizeBytes: number;
};

export type CreateTusLocationResult =
  | { location: string }
  | { error: string };

/** POST a new TUS upload and return the absolute Location URL. */
export async function createTusLocation(
  input: CreateTusLocationInput,
): Promise<CreateTusLocationResult> {
  try {
    const response = await fetch(input.uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        apikey: input.apikey,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(input.sizeBytes),
        'Upload-Metadata': buildTusUploadMetadata({
          bucket: input.bucket,
          objectPath: input.objectPath,
          contentType: input.contentType,
        }),
        'x-upsert': 'true',
      },
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 240);
      return {
        error: `TUS create HTTP ${response.status}${body ? `: ${body}` : ''}`,
      };
    }

    const location = response.headers.get('location');
    if (!location) {
      return {
        error:
          'TUS create missing Location header (check bucketName metadata + storage endpoint)',
      };
    }

    const absolute = location.startsWith('http')
      ? location
      : new URL(location, input.uploadEndpoint).toString();

    return { location: absolute };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'TUS create failed',
    };
  }
}
