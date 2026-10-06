/** Décode les CSV UTF-8 courants et les anciens exports Excel Windows-1252. */
export function decoderCsv(source: ArrayBuffer | Uint8Array): string {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
