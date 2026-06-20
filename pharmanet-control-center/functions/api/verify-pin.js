import { checkAppPin, pinRequiredResponse } from './_auth.js';

export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
