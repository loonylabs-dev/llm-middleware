/**
 * One-off probe: which EU locations actually serve gemini-3.1-flash-lite and
 * gemini-3.5-flash on Vertex AI for THIS project's credentials.
 * Run: node tests/manual/eu-region-probe.js
 */
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

// minimal .env loader (avoid extra deps)
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '');
      process.env[m[1]] = v;
    }
  }
}

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash-preview'];
const TARGETS = [
  { label: 'eu  (Multi-Region)', location: 'eu', host: 'https://aiplatform.eu.rep.googleapis.com' },
  { label: 'global', location: 'global', host: 'https://aiplatform.googleapis.com' },
  { label: 'europe-west3 (Frankfurt)', location: 'europe-west3', host: 'https://europe-west3-aiplatform.googleapis.com' },
  { label: 'europe-west4 (Netherlands)', location: 'europe-west4', host: 'https://europe-west4-aiplatform.googleapis.com' },
  { label: 'europe-west1 (Belgium)', location: 'europe-west1', host: 'https://europe-west1-aiplatform.googleapis.com' },
  { label: 'europe-north1 (Finland)', location: 'europe-north1', host: 'https://europe-north1-aiplatform.googleapis.com' },
];

async function main() {
  console.log(`Project: ${PROJECT}\nKey: ${KEY}\n`);
  const auth = new GoogleAuth({
    keyFile: KEY,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
    generationConfig: { maxOutputTokens: 8 },
  });

  for (const model of MODELS) {
    console.log(`\n================ ${model} ================`);
    for (const t of TARGETS) {
      const ver = process.env.PROBE_APIVER || 'v1';
      const url = `${t.host}/${ver}/projects/${PROJECT}/locations/${t.location}/publishers/google/models/${model}:generateContent`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body,
        });
        let detail = '';
        if (!res.ok) {
          const txt = await res.text();
          try { detail = JSON.parse(txt).error?.message || txt; } catch { detail = txt; }
          detail = String(detail).replace(/\s+/g, ' ').slice(0, 130);
        }
        const verdict = res.ok ? 'OK ✅' : (res.status === 404 ? 'NOT AVAILABLE ❌' : `HTTP ${res.status}`);
        console.log(`  ${t.label.padEnd(28)} -> ${verdict}${detail ? '  | ' + detail : ''}`);
      } catch (e) {
        console.log(`  ${t.label.padEnd(28)} -> ERROR  | ${String(e.message).slice(0, 120)}`);
      }
    }
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
