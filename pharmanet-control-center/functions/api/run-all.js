import { runAll } from '../../src/runner.js';
import { checkAppPin, pinRequiredResponse } from './_auth.js';

/**
 * Streams newline-delimited JSON instead of one buffered response. A bulk
 * Run All can take several minutes for a few hundred rows (each one is a
 * live round trip to PharmaNET) — a single request/response with zero bytes
 * sent until the very end looks like a dead connection to the browser (and
 * to anything in between) and gets dropped as "Failed to fetch" well before
 * the server itself has actually failed. Streaming a progress line per row
 * keeps the connection visibly alive and gives real feedback.
 *
 * Each line is `{ type: 'progress', completed, total, status, party }` until
 * the final line, which is either `{ type: 'done', summary, log, failedRows,
 * zipBase64 }` or `{ type: 'error', message }`. The HTTP status is always
 * 200 because by the time an error can occur, headers (and possibly some
 * progress lines) have already been sent.
 */
export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const { userId, password, rows, sourceExcelBase64, sourceExcelName } = payload || {};
  if (!userId || !password) {
    return json({ error: 'PharmaNET User ID and Password are required.' }, 400);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'No validated rows were supplied. Validate the Excel file first.' }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        const result = await runAll({
          userId,
          password,
          validatedRows: rows,
          sourceExcelBytes: sourceExcelBase64 ? base64ToArrayBuffer(sourceExcelBase64) : null,
          sourceExcelName,
          onProgress: (completed, total, entry) => {
            send({ type: 'progress', completed, total, status: entry.Status, party: entry.PartyName });
          },
        });
        send({
          type: 'done',
          summary: result.summary,
          log: result.log,
          failedRows: result.failedRows,
          zipBase64: arrayBufferToBase64(result.zipBytes),
        });
      } catch (err) {
        // Never echo the password; log a generic message server-side only.
        console.error('run-all failed:', err.message);
        send({ type: 'error', message: 'Run All failed. ' + err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(bytes) {
  const CHUNK_SIZE = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    result += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(result);
}
