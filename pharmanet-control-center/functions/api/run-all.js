import { runAll } from '../../src/runner.js';
import { checkAppPin, pinRequiredResponse } from './_auth.js';

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

  try {
    const result = await runAll({
      userId,
      password,
      validatedRows: rows,
      sourceExcelBytes: sourceExcelBase64 ? base64ToArrayBuffer(sourceExcelBase64) : null,
      sourceExcelName,
    });

    return json(
      {
        summary: result.summary,
        log: result.log,
        failedRows: result.failedRows,
        zipBase64: arrayBufferToBase64(result.zipBytes),
      },
      200
    );
  } catch (err) {
    // Never echo the password; log a generic message server-side only.
    console.error('run-all failed:', err.message);
    return json({ error: 'Run All failed. ' + err.message }, 500);
  }
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
