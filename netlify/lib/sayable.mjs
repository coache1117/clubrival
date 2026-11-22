// CLUB RIVAL · CR046 · SAYABLE - turns what the coach writes into what a coach SAYS, before it goes to the voice.
// Coach E, 22 Nov: "check his vocabulary ... 170 ... instead of saying live, it says live. You gotta have a test for that."
// The tests live in tests/sayable.test.mjs and must pass before a build ships.
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD = ['zeroth','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth','twenty-first','twenty-second','twenty-third','twenty-fourth','twenty-fifth','twenty-sixth','twenty-seventh','twenty-eighth','twenty-ninth','thirtieth','thirty-first'];
export function words(n) {                       // 0..999999, plain English
  n = Math.round(+n); if (!isFinite(n)) return String(n); if (n < 0) return 'minus ' + words(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + words(n % 100) : '');
  if (n < 1e6) return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
  return String(n);
}
// how a coach says a weight: 135 -> "one thirty-five", 105 -> "one oh five", 200 -> "two hundred", 45 -> "forty-five", 1,000 -> "one thousand"
export function weight(n) {
  n = Math.round(+n);
  if (n >= 100 && n < 1000 && n % 100 !== 0) { const h = Math.floor(n / 100), r = n % 100; return ONES[h] + ' ' + (r < 10 ? 'oh ' + ONES[r] : words(r)) }
  return words(n);
}
// clock time: 6:00 -> "six o'clock", 6:05 -> "six oh five", 10:30 -> "ten thirty"
export function clock(h, m) {
  h = +h; m = +m; const hh = ((h + 11) % 12) + 1;
  return m === 0 ? words(hh) + ' o’clock' : words(hh) + ' ' + (m < 10 ? 'oh ' + ONES[m] : words(m));
}
// "LIVE" the event (rhymes with five) vs "live" the verb (rhymes with give). The voice can't tell, so the event gets spelled the way it sounds.
const LIVE_BEFORE = /\b(frenzy|rival|go|goes|going|went|gone|is|are|was|were|we’re|we're|it’s|it's|you’re|you're|i’m|i'm|now|stay|staying|be|being|stream|streaming)\s+live\b/gi;
const LIVE_AFTER = /\blive\s+(?=(event|events|show|shows|session|sessions|mode|class|classes|round|rounds|board|boards|chat|now|stream|streams|feed|standings|tracking|race|races|game|games|frenzy|ghost|leaderboard|scores?|results?|coaching|video|tv|on)\b)/gi;

export function sayable(t) {
  let s = String(t || '');
  // symbols and shorthand first
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, '’').replace(/\s*&\s*/g, ' and ').replace(/\bw\/\s*/gi, 'with ').replace(/\bvs\.?(?=\s)/gi, 'versus');
  s = s.replace(/→|->/g, ' to ').replace(/\s*·\s*/g, ', ').replace(/\s+—\s+|\s+-\s+/g, ', ');
  // sets x reps: "3x8", "3 x 8", "3 × 8" -> "three sets of eight"
  s = s.replace(/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b(?!\s*(lb|lbs|pounds|kg))/gi, (m, a, b) => words(a) + ' sets of ' + words(b));
  // reps at a weight: "12 × 135", "12x135 lb", "12 at 135" -> "twelve reps at one thirty-five"
  s = s.replace(/\b(\d{1,2})\s*(?:[x×]|reps?\s+at|at)\s*(\d{2,4})(\s*(?:lb|lbs|pounds?|#))?\b/gi, (m, r, w, u) => words(r) + ' reps at ' + weight(w) + (u ? ' pounds' : ''));
  // weights with units
  s = s.replace(/\b(\d{1,4}(?:,\d{3})?)\s*(?:lb|lbs|pounds?|#)(?![a-z])/gi, (m, n) => weight(n.replace(/,/g, '')) + ' pounds');
  s = s.replace(/\b(\d{1,4})\s*(?:kg|kgs|kilos?)\b/gi, (m, n) => words(n) + ' kilos');
  // durations: "7h 12m", "8h 00m", "45 min", "90 sec", "5.0 mi"
  s = s.replace(/\b(\d{1,2})h\s*(\d{1,2})m(?:in)?\b/gi, (m, h, mm) => words(h) + ' hour' + (+h === 1 ? '' : 's') + (+mm ? ' ' + words(mm) + ' minute' + (+mm === 1 ? '' : 's') : ''));
  s = s.replace(/\b(\d{1,3})\s*(?:min|mins)\b\.?/gi, (m, n) => words(n) + ' minute' + (+n === 1 ? '' : 's'));
  s = s.replace(/\b(\d{1,3})\s*(?:sec|secs|s)\b\.?/gi, (m, n) => words(n) + ' second' + (+n === 1 ? '' : 's'));
  s = s.replace(/\b(\d+)(?:\.(\d))?\s*mi\b\.?/gi, (m, a, b) => words(a) + (b && b !== '0' ? ' point ' + words(b) : '') + ' mile' + (+a === 1 && (!b || b === '0') ? '' : 's'));
  // clock times: "6:30 AM", "10:05pm", "18:00"
  s = s.replace(/\b(\d{1,2}):(\d{2})\s*([ap])(?:\.\s*m\.|\s*m)(?![a-z])/gi, (m, h, mm, ap) => clock(h, mm) + (ap.toLowerCase() === 'a' ? ' A M' : ' P M'));
  s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => clock(h, mm));
  // run / walk times "31:48" were caught above as a clock; minutes:seconds in a ghost context read better as "31 48" - handled by clock(), good enough
  // money
  s = s.replace(/\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g, (m, d, c) => words(d.replace(/,/g, '')) + ' dollar' + (d === '1' ? '' : 's') + (c && c !== '00' ? ' and ' + words(c) + ' cents' : ''));
  // percents
  s = s.replace(/\b(\d+)\s*%/g, (m, n) => words(n) + ' percent');
  // big numbers with commas: "1,188" -> "eleven eighty-eight" (scores), "12,000" -> "twelve thousand"
  s = s.replace(/\b(\d{1,3}),(\d{3})\b/g, (m, a, b) => { const n = +(a + b); return n % 1000 === 0 ? words(n) : (n < 10000 && n % 100 !== 0 ? words(Math.floor(n / 100)) + ' ' + (n % 100 < 10 ? 'oh ' + ONES[n % 100] : words(n % 100)) : words(n)) });
  // ordinal-ish shorthand
  s = s.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, (m, n) => ORD[+n] || m);
  // LIVE the event
  s = s.replace(LIVE_BEFORE, (m, a) => a + ' lyve').replace(LIVE_AFTER, 'lyve ').replace(/\bLIVE\b/g, 'lyve');
  // letters a coach spells out
  s = s.replace(/\bXP\b/g, 'X P').replace(/\bPRs?\b/g, m => m === 'PRs' ? 'P Rs' : 'P R').replace(/\bAMRAP\b/g, 'am rap').replace(/\bRPE\b/g, 'R P E').replace(/\bTV\b/g, 'T V');
  // build codes (RR34, MO011) are never read out
  s = s.replace(/\b(?:CR|RR|RU|MO|MR|RS|RI|BZ|STR|RX|OR|RV|RT)\d{2,3}[A-Z]?\b/g, '');
  s = s.replace(/(^|\s)\+(\d)/g, '$1plus $2');
  return s.replace(/\s+([,.!?])/g, '$1').replace(/[,\s]+$/, '').replace(/,([.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
}
