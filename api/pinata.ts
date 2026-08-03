export type PinataUpload = { cid: string; uri: `ipfs://${string}` };

/** Pin immutable JSON/media through Pinata's authenticated v3 upload endpoint. */
export async function pinJson(pinataJwt: string, name: string, value: unknown): Promise<PinataUpload> {
  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, network: 'public', type: 'json', content: value }),
  });
  if (!response.ok) throw new Error(`Pinata JSON upload failed (${response.status}).`);
  const body = (await response.json()) as { data?: { cid?: string } };
  const cid = body.data?.cid;
  if (!cid) throw new Error('Pinata response did not include a CID.');
  return { cid, uri: `ipfs://${cid}` };
}

export async function pinGif(pinataJwt: string, name: string, bytes: Uint8Array): Promise<PinataUpload> {
  const form = new FormData();
  form.set('network', 'public');
  form.set('file', new Blob([bytes], { type: 'image/gif' }), name);
  const response = await fetch('https://uploads.pinata.cloud/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${pinataJwt}` }, body: form });
  if (!response.ok) throw new Error(`Pinata GIF upload failed (${response.status}).`);
  const body = (await response.json()) as { data?: { cid?: string } };
  if (!body.data?.cid) throw new Error('Pinata response did not include a CID.');
  return { cid: body.data.cid, uri: `ipfs://${body.data.cid}` };
}
