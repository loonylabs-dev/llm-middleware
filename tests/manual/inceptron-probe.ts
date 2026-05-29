/**
 * Live API probe for Inceptron (OpenAI-compatible chat completions).
 *
 * Goal: BEFORE writing a provider, learn the real wire format against the user's
 * own account/key — exactly the "verify live, then build" flow used for Bedrock
 * and Azure. Nothing here is assumed; we dump raw responses and inspect.
 *
 * It answers four questions:
 *   1. Which base URL actually serves the curated models — the dashboard quickstart
 *      shows `https://openrouter.inceptron.io/v1`, the public docs show
 *      `https://api.inceptron.io/v1`. We probe both.
 *   2. Does GLM-5.1 accept `reasoning_effort` (OpenAI style) or reject it (HTTP 400)?
 *   3. Where does the reasoning/thinking text surface — `message.reasoning_content`,
 *      `message.reasoning`, `message.thinking`, or inline in `content`?
 *   4. What `usage` fields exist (reasoning_tokens / cached_tokens / *_details)?
 *
 * Usage (Windows): npx ts-node tests/manual/inceptron-probe.ts
 * Requires in .env: INCEPTRON_API_KEY  (optionally INCEPTRON_MODEL, INCEPTRON_BASE_URL)
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_KEY = process.env.INCEPTRON_API_KEY;
const MODEL = process.env.INCEPTRON_MODEL || 'zai-org/GLM-5.1-FP8';
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 4096);

// Both candidate hosts — the dashboard quickstart vs. the public docs.
const BASE_URLS = [
  process.env.INCEPTRON_BASE_URL,            // explicit override wins
  'https://openrouter.inceptron.io/v1',      // from the user's dashboard quickstart
  'https://api.inceptron.io/v1',             // from the public docs
].filter(Boolean) as string[];

const SYSTEM = 'You are a direct assistant. Answer concisely.';
const PROMPT =
  'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. ' +
  'How much does the ball cost? Give the final number, then one short sentence.';

interface ProbeResult {
  label: string;
  ok: boolean;
  status: number | string;
  finishReason?: string;
  contentLen?: number;
  reasoningField?: string;   // which key carried the reasoning text, if any
  reasoningLen?: number;
  usage?: Record<string, unknown>;
  errorData?: unknown;
}

/** Detect where the reasoning text lives in the returned message object. */
function detectReasoning(message: Record<string, any>): { field?: string; len: number } {
  const candidates = ['reasoning_content', 'reasoning', 'thinking'];
  for (const key of candidates) {
    const val = message?.[key];
    if (typeof val === 'string' && val.length > 0) {
      return { field: key, len: val.length };
    }
  }
  return { len: 0 };
}

async function probe(
  baseUrl: string,
  label: string,
  body: Record<string, unknown>,
  dumpRaw = false
): Promise<ProbeResult> {
  console.log('\n' + '-'.repeat(72));
  console.log(`[${label}]  ${baseUrl}`);
  console.log('request body:', JSON.stringify(body));

  try {
    const res = await axios.post(
      `${baseUrl}/chat/completions`,
      { model: MODEL, max_tokens: MAX_TOKENS, ...body },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 180000,
        validateStatus: () => true, // never throw on HTTP status; inspect manually
      }
    );

    if (res.status !== 200) {
      console.log(`HTTP ${res.status}`);
      console.log('error body:', JSON.stringify(res.data)?.slice(0, 800));
      return { label, ok: false, status: res.status, errorData: res.data };
    }

    const data = res.data;
    const message = data?.choices?.[0]?.message ?? {};
    const finishReason = data?.choices?.[0]?.finish_reason;
    const reasoning = detectReasoning(message);

    console.log('HTTP 200');
    console.log('finish_reason  :', finishReason);
    console.log('content length :', (message.content ?? '').length);
    console.log('content        :', JSON.stringify((message.content ?? '').slice(0, 200)));
    console.log('reasoning field:', reasoning.field ?? '(none)', '| len:', reasoning.len);
    if (reasoning.field && reasoning.len) {
      console.log('reasoning head :', JSON.stringify(String(message[reasoning.field]).slice(0, 200)));
    }
    console.log('usage          :', JSON.stringify(data?.usage));
    console.log('message keys   :', Object.keys(message).join(', '));

    if (dumpRaw) {
      console.log('\n>>> FULL RAW RESPONSE >>>');
      console.log(JSON.stringify(data, null, 2));
      console.log('<<< END RAW RESPONSE <<<');
    }

    return {
      label,
      ok: true,
      status: 200,
      finishReason,
      contentLen: (message.content ?? '').length,
      reasoningField: reasoning.field,
      reasoningLen: reasoning.len,
      usage: data?.usage,
    };
  } catch (e: any) {
    console.log('REQUEST FAILED:', e?.code || e?.message);
    return { label, ok: false, status: e?.code || 'error', errorData: e?.message };
  }
}

async function main() {
  console.log('Inceptron live probe');
  console.log('Model:', MODEL, '| maxTokens:', MAX_TOKENS, '| key set:', !!API_KEY);
  if (!API_KEY) {
    console.error('\nINCEPTRON_API_KEY not set in .env — aborting.');
    process.exit(1);
  }

  // Step 1: find a working base URL with a minimal request.
  let workingBase: string | null = null;
  for (const base of BASE_URLS) {
    const r = await probe(base, 'endpoint-probe', {
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      max_tokens: 16,
    });
    if (r.ok) {
      workingBase = base;
      console.log(`\n==> Using base URL: ${base}`);
      break;
    }
  }

  if (!workingBase) {
    console.error('\nNo working base URL found. See errors above.');
    process.exit(1);
  }

  // Step 2: baseline (no reasoning param) — dump the FULL raw response once so we
  // see every field the API returns by default (incl. any default reasoning text).
  // Skipped when PROBE_EFFORTS is set, to keep the call count low (avoid 429).
  const results: ProbeResult[] = [];
  if (!process.env.PROBE_EFFORTS) {
    results.push(
      await probe(workingBase, 'baseline (no reasoning param)', {
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: PROMPT },
        ],
        temperature: 0.3,
      }, /* dumpRaw */ true)
    );
  }

  // Step 3: does it accept reasoning_effort? Sweep the OpenAI-style values.
  // Override the set via PROBE_EFFORTS (comma-separated) to verify a single value.
  const efforts = (process.env.PROBE_EFFORTS || 'none,low,high').split(',');
  for (const effort of efforts) {
    results.push(
      await probe(workingBase, `reasoning_effort=${effort}`, {
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: PROMPT },
        ],
        temperature: 0.3,
        reasoning_effort: effort,
      })
    );
  }

  // Summary
  console.log('\n' + '#'.repeat(72));
  console.log('SUMMARY  (base:', workingBase + ')');
  console.log('#'.repeat(72));
  console.log('label                          | status | finish      | content | reasoning(field/len)');
  console.log('-------------------------------|--------|-------------|---------|----------------------');
  for (const r of results) {
    console.log(
      `${r.label.padEnd(30)} | ${String(r.status).padEnd(6)} | ${String(r.finishReason ?? '-').padEnd(11)} | ` +
      `${String(r.contentLen ?? '-').padStart(7)} | ${(r.reasoningField ?? '-')}/${r.reasoningLen ?? 0}`
    );
  }
  console.log('\nReadout:');
  console.log('- reasoning field tells us which key to map to message.thinking in the provider.');
  console.log('- if reasoning_effort=* returns HTTP 400, GLM-5.1 has its own thinking switch (check raw dump).');
  console.log('- check the usage block in the raw dump for reasoning_tokens / cached_tokens.');
}

main().catch(console.error);
