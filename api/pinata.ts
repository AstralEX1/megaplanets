export type PinataUpload = { cid: string; uri: `ipfs://${string}` };

async function uploadPublicFile(pinataJwt: string, name: string, file: Blob): Promise<PinataUpload> {
  const form = new FormData();
  form.set('network', 'public');
  form.set('file', file, name);
  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Pinata upload failed (${response.status}).`);
  const body = (await response.json()) as { data?: { cid?: string } };
  const cid = body.data?.cid;
  if (!cid) throw new Error('Pinata response did not include a CID.');
  return { cid, uri: `ipfs://${cid}` };
}

/** Pin immutable JSON/media through Pinata's multipart v3 upload endpoint. */
export async function pinJson(pinataJwt: string, name: string, value: unknown): Promise<PinataUpload> {
  return uploadPublicFile(pinataJwt, name, new Blob([JSON.stringify(value)], { type: 'application/json' }));
}

export async function pinGif(pinataJwt: string, name: string, bytes: Uint8Array): Promise<PinataUpload> {
  return uploadPublicFile(pinataJwt, name, new Blob([bytes], { type: 'image/gif' }));
}
