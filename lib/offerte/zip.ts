import { inflateRawSync } from "node:zlib";

/** Reads the first file out of a simple ZIP (store or deflate). */
export function unzipFirstFile(buffer: Buffer) {
  const start = buffer.indexOf(Buffer.from("PK\x03\x04"));
  if (start < 0) throw new Error("ZIP locale header missing");
  const method = buffer.readUInt16LE(start + 8);
  const compSize = buffer.readUInt32LE(start + 18);
  const nameLen = buffer.readUInt16LE(start + 26);
  const extraLen = buffer.readUInt16LE(start + 28);
  const dataStart = start + 30 + nameLen + extraLen;
  const payload = buffer.subarray(dataStart, dataStart + compSize);
  if (method === 0) return payload.toString("utf8");
  if (method === 8) return inflateRawSync(payload).toString("utf8");
  throw new Error(`ZIP compression ${method} not supported`);
}
