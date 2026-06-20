import { parseTextLines, parseSheetRows } from '../../../src/orderFileParser.js';
import { checkAppPin, pinRequiredResponse } from '../_auth.js';
import { json } from '../_responses.js';

/**
 * Turns already browser-extracted order-file content (pasted text, PDF text,
 * or an Excel sheet's array-of-arrays) into the plain `{rawText, qty}` lines
 * that /order/prepare matches against PharmaNET's product master. No
 * PharmaNET call happens here.
 */
export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const { mode, text, rows } = payload || {};
  if (mode === 'text') {
    return json({ lines: parseTextLines(text) });
  }
  if (mode === 'sheet') {
    if (!Array.isArray(rows)) return json({ error: 'rows must be an array of arrays.' }, 400);
    return json({ lines: parseSheetRows(rows) });
  }
  return json({ error: 'mode must be "text" or "sheet".' }, 400);
}
