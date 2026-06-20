export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ pinRequired: Boolean(env.APP_PIN) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
