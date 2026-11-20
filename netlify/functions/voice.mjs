// CLUB RIVAL · CR037 · THE COACH'S VOICE (your voice). The page sends the words, this turns them into sound with ElevenLabs.
// Netlify > clubrival > Environment variables: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (your Coach E voice). Optional: ELEVENLABS_MODEL.
// Not set yet? The page quietly falls back to the phone's own voice.
const SB = 'https://glmyzwxinguqcqtgodts.supabase.co', ANON = 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  const KEY = process.env.ELEVENLABS_API_KEY, VID = process.env.ELEVENLABS_VOICE_ID; if (!KEY || !VID) return json({ error: 'not-configured' }, 503);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); if (!jwt) return json({ error: 'not-signed-in' }, 401);
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, authorization: 'Bearer ' + jwt } }); if (!ur.ok) return json({ error: 'not-signed-in' }, 401);
  let b = {}; try { b = await req.json() } catch (e) { }
  const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 700); if (!text) return json({ error: 'no text' }, 400);
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(VID) + '?output_format=mp3_44100_64', { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }) });
  if (!r.ok) { const t = await r.text().catch(() => ''); return json({ error: 'voice-failed', detail: t.slice(0, 160) }, 502) }
  return new Response(r.body, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
};
export const config = { path: '/api/voice' };
