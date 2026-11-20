// CLUB RIVAL · CR038 · THE COACH'S VOICE (your voice). The page sends the words, this turns them into sound with ElevenLabs.
// Netlify > clubrival > Environment variables: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (your Coach E voice). Optional: ELEVENLABS_MODEL_ID.
// Uses the same model and settings as RankUp's voice, which already works. If Club's own keys fail, it borrows RankUp's voice
// (rankuprival.netlify.app/api/speak) so the coach still sounds like you - and tells the page exactly why Club's keys failed.
const SB = 'https://glmyzwxinguqcqtgodts.supabase.co', ANON = 'sb_publishable_DuBWJ2pLLgaQNkoFqiuOfA_WSYzunwW';
const RANKUP = process.env.VOICE_BACKUP_URL || 'https://rankuprival.netlify.app/api/speak';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const audio = (buf, via, why) => new Response(buf, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-voice-via': via, 'x-voice-club-why': why || '' } });

async function borrow(text) {
  try {
    const r = await fetch(RANKUP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) return null; const b = await r.arrayBuffer(); return b.byteLength > 200 ? b : null;
  } catch (e) { return null }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'post only' }, 405);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); if (!jwt || jwt === 'undefined' || jwt === 'null') return json({ error: 'not-signed-in' }, 401);
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, authorization: 'Bearer ' + jwt } }); if (!ur.ok) return json({ error: 'not-signed-in' }, 401);
  let b = {}; try { b = await req.json() } catch (e) { }
  const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 700); if (!text) return json({ error: 'no text' }, 400);
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
