/** Verify the X-App-Pin header against the APP_PIN secret, if one is configured. */
export function checkAppPin(request, env) {
  if (!env.APP_PIN) return true; // PIN not configured, nothing to check
  const supplied = request.headers.get('X-App-Pin') || '';
  return supplied === env.APP_PIN;
}

export function pinRequiredResponse() {
  return new Response(JSON.stringify({ error: 'Invalid or missing App PIN.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
