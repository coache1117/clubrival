// CLUB RIVAL · CR046 (says it like a coach) · CR040 · THE COACH'S VOICE (your voice) - the Club coach AND the mic in Rep, RankUp, Mind, Stride, Rest, Rise, Money, Biz. The page sends the words, this turns them into sound with ElevenLabs.
// Netlify > clubrival > Environment variables: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (your Coach E voice). Optional: ELEVENLABS_MODEL_ID.
// Uses the same model and settings as RankUp's voice, which already works. If Club's own keys fail, it borrows RankUp's voice
// (rankuprival.netlify.app/api/speak) so the coach still sounds like you - and tells the page exactly why Club's keys failed.
import { sayable } from '../lib/sayable.mjs';
const SB = 'https://glmyzwxinguqcqtgodts.supabase.co', ANON = 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW';
const RANKUP = process.env.VOICE_BACKUP_URL || 'https://rankuprival.netlify.app/api/speak';
// Who may ask: Club itself, the other Rival sites (*.netlify.app, and our own rival domains). Every call still needs a signed-in Rival account.
const okOrigin = o => /^https:\/\/([a-z0-9-]+\.)*(netlify\.app|[a-z0-9-]*rival\.(com|app))$/i.test(o || '');
const json0 = (cors, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } });
const audio0 = (cors, buf, via, why) => new Response(buf, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-voice-via': via, 'x-voice-club-why': why || '', ...cors } });

async function borrow(text) {
  try {
    const r = await fetch(RANKUP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) return null; const b = await r.arrayBuffer(); return b.byteLength > 200 ? b : null;
  } catch (e) { return null }
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const CORS = okOrigin(origin) ? { 'access-control-allow-origin': origin, 'vary': 'Origin', 'access-control-expose-headers': 'x-voice-via, x-voice-club-why' } : {};
  const json = (o, st) => json0(CORS, o, st), audio = (b, v, w) => audio0(CORS, b, v, w);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' } });
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); if (!jwt || jwt === 'undefined' || jwt === 'null') return json({ error: 'not-signed-in' }, 401);
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, authorization: 'Bearer ' + jwt } }); if (!ur.ok) return json({ error: 'not-signed-in' }, 401);
  let b = {}; try { b = await req.json() } catch (e) { }
  const raw = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 700); if (!raw) return json({ error: 'no text' }, 400);
  const text = sayable(raw);   /* CR046 · say it like a coach: 170 lb -> one seventy pounds, Frenzy Live -> lyve (tests: tests/sayable.test.mjs) */
  const KEY = process.env.ELEVENLABS_API_KEY, VID = process.env.ELEVENLABS_VOICE_ID;
  let fail;
  if (!KEY || !VID) fail = { stage: 'config', ok: false, keyPresent: !!KEY, voiceIdPresent: !!VID };
  else {
    const model = process.env.ELEVENLABS_MODEL_ID || process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(VID.trim()) + '?output_format=mp3_44100_128', { method: 'POST', headers: { 'xi-api-key': KEY.trim(), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }) });
      if (r.ok) { const buf = await r.arrayBuffer(); if (buf.byteLength > 200) return audio(buf, 'club'); fail = { stage: 'elevenlabs', ok: false, upstreamStatus: 200, detail: 'empty audio' } }
      else { let d = ''; try { d = (await r.text()).slice(0, 200) } catch (e) { } fail = { stage: 'elevenlabs', ok: false, upstreamStatus: r.status, detail: d, model } }
    } catch (e) { fail = { stage: 'network', ok: false, error: 'elevenlabs unreachable' } }
  }
  const why = fail.stage === 'config' ? 'not set' : fail.upstreamStatus ? 'elevenlabs ' + fail.upstreamStatus : fail.stage;
  const bb = await borrow(text); if (bb) return audio(bb, 'rankup', why);
  return json(fail, fail.stage === 'config' ? 503 : 502);
};
export const config = { path: '/api/voice' };
