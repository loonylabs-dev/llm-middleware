/**
 * Raw probe against the MiniMax API — what does it ACTUALLY return?
 *
 *   MINIMAX_API_KEY=... npx ts-node tests/manual/minimax-probe.ts
 *
 * ## Why this file exists
 *
 * The provider was written against the answers below, not against the docs.
 * Three assumptions that looked obvious were all wrong, and each would have
 * produced a provider that works and quietly misleads its caller:
 *
 *   1. "Reasoning arrives in `message.reasoning`" — it does not. `message`
 *      carries exactly `role` and `content`, and the reasoning sits INSIDE
 *      `content` as a `<think>…</think>` block.
 *   2. "`reasoning_effort: 'none'` turns it off" — accepted with HTTP 200, and
 *      the block is still there, with MORE reasoning tokens than the call
 *      without it.
 *   3. "`response_format: {type:'json_object'}` constrains the output" —
 *      accepted with HTTP 200, answer still wrapped in `<think>`.
 *
 * Run it again whenever MiniMax ships a new model: the provider's behaviour
 * rests on these three answers, and none of them is documented upstream.
 *
 * Deliberately dependency-free (plain `fetch`, no middleware imports) so it
 * shows the wire, not our interpretation of it.
 */
import * as dotenv from 'dotenv';

dotenv.config();

const key = process.env.MINIMAX_API_KEY;
const base = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1').replace(/\/+$/, '');
const model = process.env.MINIMAX_MODEL || 'MiniMax-M3';

async function probe(body: Record<string, unknown>, label: string): Promise<void> {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n### ${label} → HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`   ${text.slice(0, 300)}`);
    return;
  }
  const json = JSON.parse(text);
  const message = json.choices?.[0]?.message ?? {};
  const content = String(message.content ?? '');
  console.log(`   message fields: ${Object.keys(message).join(', ')}`);
  console.log(`   usage: ${JSON.stringify(json.usage)}`);
  console.log(`   content starts: ${JSON.stringify(content.slice(0, 100))}`);
  console.log(`   <think> present: ${content.includes('<think>')}`);
  // Named explicitly: their ABSENCE is the finding, and an absent field that
  // nobody looked for reads the same as one that was never there.
  console.log(`   message.reasoning: ${message.reasoning === undefined ? 'absent' : 'PRESENT'}`);
  console.log(`   message.reasoning_content: ${message.reasoning_content === undefined ? 'absent' : 'PRESENT'}`);
}

async function main(): Promise<void> {
  if (!key) {
    console.error('MINIMAX_API_KEY is not set — nothing to probe.');
    process.exit(1);
  }
  console.log(`Probing ${base} with model ${model}`);

  const plain = {
    model,
    messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
    temperature: 0.05,
  };

  await probe(plain, 'plain');
  await probe({ ...plain, reasoning_effort: 'none' }, "reasoning_effort: 'none'");
  await probe(
    {
      ...plain,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'Gib ein JSON-Array mit einem Objekt {"a":1} aus.' }],
    },
    'response_format: json_object',
  );

  console.log(
    '\nExpected (measured 2026-08-06, MiniMax-M3): all three HTTP 200, all three with a\n'
    + '<think> block in content, no `reasoning` / `reasoning_content` field anywhere.\n'
    + 'If that has changed, the provider and docs/MINIMAX.md need revisiting.',
  );
}

void main();
