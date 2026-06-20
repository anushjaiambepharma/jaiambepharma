import { validateDownloadDocuments } from '../../src/validator.js';
import { checkAppPin, pinRequiredResponse } from './_auth.js';

export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const { headers, rows } = payload || {};
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return json({ error: 'Expected { headers: string[], rows: object[] } from the Download_Documents sheet.' }, 400);
  }

  const result = validateDownloadDocuments(headers, rows);
  return json(result, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
