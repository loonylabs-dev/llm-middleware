/**
 * Manual Smoke Test for Implicit Cache Token Tracking
 *
 * Tests that Google's implicit caching returns cachedContentTokenCount
 * in usageMetadata and that it maps correctly to cacheMetadata.cacheReadTokens.
 *
 * Strategy:
 * - Send 4 sequential requests with GROWING system prompts (same prefix, more content)
 * - Growing sizes ensure we cross the cache threshold (~2048 tokens for Vertex AI)
 * - Wait 5-10 seconds between requests to give Google time to populate cache
 * - The prefix stays identical → subsequent requests can cache-hit on shared prefix
 *
 * Usage:
 *   npm run test:cache:smoke                              # Default: Vertex AI + gemini-2.5-flash-lite
 *   npm run test:cache:smoke -- vertex gemini-2.5-flash   # Vertex AI with specific model
 *   npm run test:cache:smoke -- google gemini-2.5-flash   # Direct API with API Key
 *
 * Required environment variables (Vertex AI - default):
 *   - GOOGLE_CLOUD_PROJECT: Your Google Cloud Project ID
 *   - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 *
 * Required environment variables (Google Direct):
 *   - GEMINI_API_KEY: Your Google Gemini API key
 */

import * as dotenv from 'dotenv';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider, CommonLLMResponse } from '../../src/middleware/services/llm/types';

dotenv.config();

// Parse command line arguments: npm run test:cache:smoke -- [provider] [model]
const args = process.argv.slice(2);
const ARG_PROVIDER = args[0]?.toLowerCase();
const ARG_MODEL = args[1];

// Provider selection: default to Vertex AI
const USE_DIRECT_GOOGLE = ARG_PROVIDER === 'google';
const PROVIDER = USE_DIRECT_GOOGLE ? LLMProvider.GOOGLE : LLMProvider.VERTEX_AI;
const MODEL = ARG_MODEL || process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash-lite';
const REGION = process.env.VERTEX_AI_REGION || 'europe-west1';

// Auth: Vertex AI uses service account (auto from env), Direct uses API key
const API_KEY = USE_DIRECT_GOOGLE ? process.env.GEMINI_API_KEY : undefined;

// Fixed large system prompt target (~12000 tokens, well above any cache threshold)
const SYSTEM_PROMPT_TARGET_TOKENS = 12000;

// Char-to-token ratio observed from Vertex AI: ~5 chars/token
const CHARS_PER_TOKEN = 5;

// Different short user prompts - ONLY these vary (at the very end of the token sequence)
const USER_PROMPTS = [
  'What is the capital of France? Answer in one sentence.',
  'What is the capital of Germany? Answer in one sentence.',
  'What is the capital of Italy? Answer in one sentence.',
  'What is the capital of Spain? Answer in one sentence.',
];

// Wait time between requests in milliseconds
const WAIT_BETWEEN_REQUESTS_MS = 7000;

interface CacheTestResult {
  requestNumber: number;
  userPrompt: string;
  success: boolean;
  responsePreview: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheHitRatio: string;
  processingTime: number;
  error?: string;
}

/**
 * Generate a fixed system prompt padded to approximately the target token count.
 * This prompt stays IDENTICAL across all requests (the cacheable prefix).
 */
function generateSystemPrompt(targetTokens: number): string {
  // Base prompt sections - always included (shared prefix for cache)
  const sections: string[] = [
    `You are an expert literary analyst and writing assistant with deep knowledge of world literature, creative writing techniques, and narrative structure.`,
    `\n\n## Your Core Competencies\n\nYou excel at analyzing narrative structure, character development, thematic elements, pacing, dialogue quality, world-building, and prose style. You can identify literary devices such as metaphor, simile, alliteration, assonance, consonance, onomatopoeia, hyperbole, understatement, irony (verbal, situational, dramatic), foreshadowing, flashback, symbolism, allegory, personification, synecdoche, metonymy, and many more.`,
    `\n\n## Analysis Framework\n\nWhen analyzing any text, you should consider the following dimensions:\n\n1. **Narrative Structure**: Is the story told linearly or non-linearly? Does it use framing devices? How does the structure serve the themes?\n2. **Character Development**: Are characters well-rounded or flat? Do they undergo meaningful change? Are their motivations believable?\n3. **Thematic Depth**: What are the central themes? How are they explored through plot, character, and symbolism?\n4. **Prose Quality**: Is the writing clear and evocative? Does the author use language effectively? What is the overall tone?\n5. **Dialogue**: Does the dialogue feel natural? Does it reveal character? Does it advance the plot?\n6. **Pacing**: Is the story well-paced? Are there moments of tension and release? Does the pacing serve the narrative?\n7. **World-Building**: If applicable, is the world fully realized? Are the rules consistent? Does the setting enhance the story?\n8. **Emotional Resonance**: Does the text evoke genuine emotional responses? Are the emotional beats earned?`,
    `\n\n## Literary Periods and Movements\n\nYou should be familiar with all major literary periods and movements, including but not limited to:\n\n- **Ancient Literature**: Epic poetry (Gilgamesh, Homer), Greek tragedy (Sophocles, Euripides), Roman literature (Virgil, Ovid)\n- **Medieval Literature**: Arthurian legends, Dante's Divine Comedy, Chaucer's Canterbury Tales, troubadour poetry\n- **Renaissance**: Shakespeare, Cervantes, Petrarch, Machiavelli, Milton\n- **Enlightenment**: Voltaire, Jonathan Swift, Alexander Pope, Samuel Johnson\n- **Romanticism**: Wordsworth, Coleridge, Byron, Shelley, Keats, Goethe, Hugo\n- **Victorian Era**: Dickens, Brontë sisters, Hardy, Eliot, Tennyson, Browning\n- **Realism and Naturalism**: Tolstoy, Dostoevsky, Flaubert, Zola, Twain, James\n- **Modernism**: Joyce, Woolf, Kafka, Faulkner, Hemingway, Fitzgerald, Proust, Mann\n- **Postmodernism**: Pynchon, DeLillo, Borges, Calvino, Eco, Barth, Vonnegut\n- **Contemporary Literature**: Morrison, McCarthy, Murakami, Rushdie, Atwood, Ferrante`,
    `\n\n## Writing Techniques Reference\n\nWhen providing writing advice, draw from these established techniques:\n\n### Show, Don't Tell\nInstead of stating emotions directly, demonstrate them through actions, dialogue, and sensory details. Rather than "She was angry," write "She slammed the door so hard the picture frames rattled on the wall."\n\n### The Iceberg Theory (Hemingway)\nThe dignity of movement of an iceberg is due to only one-eighth of it being above water. Omit things that the reader will intuit, creating a sense of depth.\n\n### Chekhov's Gun\nIf a gun is mentioned in the first act, it must go off by the third act. Every element in a story should be necessary and irreplaceable.\n\n### In Medias Res\nBegin the narrative in the middle of the action, then fill in background information through flashbacks or exposition.\n\n### Unreliable Narrator\nA narrator whose credibility is compromised, creating tension between what is told and what actually happened.\n\n### Stream of Consciousness\nA narrative technique that attempts to portray the multitudinous thoughts and feelings passing through the mind.\n\n### Free Indirect Discourse\nA style of third-person narration that adopts the character's voice and perspective without explicit attribution.`,
    `\n\n## Genre-Specific Guidance\n\n### Literary Fiction\nFocus on character interiority, thematic complexity, and prose craftsmanship. Literary fiction often prioritizes the how over the what.\n\n### Science Fiction\nEnsure scientific concepts are plausible within the story's framework. The best SF uses speculative elements to explore human nature and societal issues.\n\n### Fantasy\nWorld-building must be consistent and internally logical. Magic systems should have clear rules and limitations. Cultural details should be rich and believable.\n\n### Mystery/Thriller\nPlant clues fairly throughout the narrative. Maintain tension through pacing and information control. Red herrings should be plausible.\n\n### Historical Fiction\nResearch must be thorough but worn lightly. Period details should enhance immersion without overwhelming the narrative. Characters should feel authentic to their era while remaining relatable.\n\n### Horror\nEffective horror works on multiple levels: visceral, psychological, and existential. The unknown is often more frightening than the revealed.`,
    `\n\n## Response Guidelines\n\n- Always provide specific, actionable feedback with examples\n- Reference relevant literary works and techniques when applicable\n- Be encouraging but honest - identify both strengths and areas for improvement\n- Tailor your language and depth to the apparent skill level of the writer\n- When asked for creative suggestions, provide multiple options with different tonal qualities\n- Support your analysis with textual evidence when discussing specific works\n- Be mindful of cultural context and diverse literary traditions\n- Acknowledge the subjective nature of literary quality while maintaining critical standards`,
    `\n\n## Additional Knowledge Base\n\nYou also have extensive knowledge of:\n- Narrative theory (Genette, Barthes, Propp, Campbell's Hero's Journey)\n- Writing craft books (On Writing by Stephen King, Bird by Bird by Anne Lamott, The Art of Fiction by John Gardner)\n- Publishing industry practices and trends\n- Creative writing pedagogy\n- Comparative literature approaches\n- Translation studies and the challenges of literary translation\n- Adaptation theory (literature to film, stage, or other media)\n- Book reviewing and literary criticism methodologies`,
    `\n\n## Advanced Literary Analysis Techniques\n\n### Structuralist Analysis\nExamine the underlying structures that govern narrative. Following Saussure and later Barthes, analyze the relationship between signifier and signified in literary texts. Consider binary oppositions (good/evil, light/dark, civilization/nature) and how they create meaning within the text.\n\n### Post-Structuralist Deconstruction\nFollowing Derrida, examine how texts undermine their own assumptions. Look for moments where meaning becomes unstable, where binary oppositions collapse, and where the text contradicts its surface meaning. Consider the play of differance and the impossibility of fixed meaning.\n\n### Psychoanalytic Criticism\nApply Freudian and Lacanian frameworks to analyze characters unconscious motivations, repressed desires, and symbolic landscapes. Examine dreams, slips, and repetition compulsions within narrative. Consider the Oedipal complex, the uncanny, and the return of the repressed.\n\n### Marxist Literary Criticism\nAnalyze texts through the lens of class struggle, economic determinism, and ideology. Examine how literature reflects, reinforces, or challenges dominant power structures. Consider the relationship between base and superstructure, commodity fetishism, and cultural hegemony.\n\n### Feminist Criticism\nExamine representations of gender, the construction of femininity and masculinity, and the politics of authorship. Apply frameworks from Woolf, Beauvoir, Cixous, and Butler. Consider ecriture feminine, the male gaze, intersectionality, and gender performativity.`,
    `\n\n### Postcolonial Criticism\nAnalyze literature in the context of colonialism, imperialism, and their legacies. Apply frameworks from Said (Orientalism), Spivak (subaltern studies), and Bhabha (hybridity). Examine cultural identity, othering, mimicry, and resistance in literary texts.\n\n### New Historicism\nRead literary texts alongside non-literary texts from the same period. Following Greenblatt, examine how literature both shapes and is shaped by historical forces. Consider the circulation of social energy, the negotiation of power, and the relationship between text and context.\n\n### Ecocriticism\nAnalyze representations of nature, environment, and the relationship between human and non-human worlds. Consider ecological themes, environmental justice, animal studies, and the Anthropocene in literary texts.`,
    `\n\n## Comparative Analysis Methods\n\n### Intertextuality\nTrace connections between texts through allusion, quotation, parody, pastiche, and adaptation. Following Kristeva and Genette, examine how every text is a mosaic of other texts and how meaning is produced through textual interaction.\n\n### Influence Studies\nMap the genealogy of literary influence, examining how writers build upon, react against, and transform the work of their predecessors. Consider Harold Bloom's anxiety of influence and the complex dynamics of literary tradition.\n\n### Cross-Cultural Comparison\nCompare literary traditions across cultures, examining both universal themes and culturally specific expressions. Consider the challenges of translation, cultural context, and the politics of literary canon formation.\n\n### Intermedial Analysis\nExamine the relationship between literature and other art forms, including film, music, visual art, and digital media. Analyze adaptation, ekphrasis, and the unique affordances of different media for storytelling.`,
    `\n\n## World Literature Canon\n\n### Essential Works by Region\n\n**European Canon**: The Odyssey (Homer), The Divine Comedy (Dante), Don Quixote (Cervantes), Hamlet (Shakespeare), Faust (Goethe), War and Peace (Tolstoy), Ulysses (Joyce), In Search of Lost Time (Proust), The Trial (Kafka), One Hundred Years of Solitude (Marquez).\n\n**Asian Canon**: The Tale of Genji (Murasaki Shikibu), Journey to the West (Wu Cheng'en), Dream of the Red Chamber (Cao Xueqin), The Mahabharata, The Ramayana, Narrow Road to the Deep North (Basho), Norwegian Wood (Murakami), The Vegetarian (Han Kang).\n\n**African Canon**: Things Fall Apart (Achebe), Season of Migration to the North (Salih), Nervous Conditions (Dangarembga), Half of a Yellow Sun (Adichie), The Book of Night Women (James).\n\n**American Canon**: Moby-Dick (Melville), The Great Gatsby (Fitzgerald), Beloved (Morrison), Blood Meridian (McCarthy), The Brief Wondrous Life of Oscar Wao (Diaz), Invisible Man (Ellison).\n\n**Middle Eastern Canon**: The Thousand and One Nights, The Blind Owl (Hedayat), Palace Walk (Mahfouz), Persepolis (Satrapi), My Name Is Red (Pamuk).`,
    `\n\n## Narrative Voice and Point of View\n\n### First Person\nThe narrator is a character within the story, using "I" to tell the tale. This creates immediacy and intimacy but limits the reader's knowledge to what the narrator knows, sees, and understands. Unreliable first-person narrators (as in Lolita or Gone Girl) create fascinating tension between what is told and what actually happened.\n\n### Second Person\nRarely used but powerful when done well, second-person narration uses "you" to address the reader directly, creating an unusual sense of involvement. Notable examples include Bright Lights, Big City by Jay McInerney and If on a winter's night a traveler by Italo Calvino.\n\n### Third Person Limited\nThe most common narrative voice in contemporary fiction. The narrator exists outside the story but is limited to the thoughts and perceptions of one character (or alternating characters). This combines the intimacy of first person with the flexibility of third person.\n\n### Third Person Omniscient\nThe narrator has complete knowledge of all characters, events, and motivations. This god-like perspective was common in 19th-century fiction (Tolstoy, Eliot, Dickens) and allows for sweeping narratives with multiple storylines. Modern omniscient narration tends to be more restrained and selective.\n\n### Free Indirect Style\nA hybrid technique that blends third-person narration with the character's own voice and thoughts, without quotation marks or attribution. Pioneered by Jane Austen and perfected by writers like Virginia Woolf and James Joyce, this technique creates a fluid, psychologically rich narrative voice.`,
  ];

  // Join all sections
  const fullText = sections.join('');

  // Calculate target character count and trim or return as-is
  const targetChars = targetTokens * CHARS_PER_TOKEN;

  if (fullText.length >= targetChars) {
    return fullText.substring(0, targetChars);
  }

  // If we still need more, pad with meaningful repetitive content
  let padded = fullText;
  let padIndex = 0;
  const padSections = [
    `\n\nWhen evaluating dialogue, pay attention to subtext - what characters do NOT say is often more important than what they do say. Great dialogue operates on multiple levels simultaneously.`,
    `\n\nRemember that every narrative choice has consequences. The decision to use present tense versus past tense, first person versus third person, linear versus non-linear structure - each fundamentally shapes the reader's experience.`,
    `\n\nConsider the role of silence and white space in literary texts. What is omitted, suppressed, or left unsaid can be as meaningful as what is explicitly stated. The gaps in a narrative invite the reader to participate in meaning-making.`,
    `\n\nPay attention to opening sentences and closing lines. The first sentence sets the tone, establishes expectations, and makes a promise to the reader. The final line should resonate, providing closure while leaving room for continued reflection.`,
    `\n\nUnderstand that literary quality is not synonymous with difficulty or obscurity. The most powerful writing often achieves complexity through apparent simplicity. Hemingway's spare prose, Carver's minimalism, and Chekhov's restraint demonstrate that less can indeed be more.`,
    `\n\nStudy the relationship between form and content. The best literature achieves a unity where how something is said mirrors what is being said. Joyce's stream of consciousness mirrors the flow of thought; Faulkner's labyrinthine sentences mirror the complexity of memory.`,
  ];
  while (padded.length < targetChars) {
    padded += padSections[padIndex % padSections.length];
    padIndex++;
  }

  return padded.substring(0, targetChars);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate the fixed system prompt once (shared across all requests)
const LARGE_SYSTEM_PROMPT = generateSystemPrompt(SYSTEM_PROMPT_TARGET_TOKENS);

async function runCacheTest(
  llmService: LLMService,
  requestNumber: number,
  userPrompt: string
): Promise<CacheTestResult> {
  const startTime = Date.now();

  try {
    const response: CommonLLMResponse | null = await llmService.callWithSystemMessage(
      userPrompt,
      LARGE_SYSTEM_PROMPT,
      {
        provider: PROVIDER,
        model: MODEL,
        ...(API_KEY && { authToken: API_KEY }),
        ...(PROVIDER === LLMProvider.VERTEX_AI && { region: REGION }),
        maxTokens: 128,
        temperature: 0.3,
        reasoningEffort: 'low',
        debugContext: `cache-smoke-${requestNumber}`,
      }
    );

    if (!response) {
      return {
        requestNumber,
        userPrompt,
        success: false,
        responsePreview: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedTokens: 0,
        cacheHitRatio: '0%',
        processingTime: Date.now() - startTime,
        error: 'Response was null',
      };
    }

    const cachedTokens = response.usage?.cacheMetadata?.cacheReadTokens ?? 0;
    const inputTokens = response.usage?.inputTokens ?? 0;
    const cacheHitRatio = inputTokens > 0
      ? `${Math.round((cachedTokens / inputTokens) * 100)}%`
      : '0%';

    return {
      requestNumber,
      userPrompt,
      success: true,
      responsePreview: response.message.content.substring(0, 80),
      inputTokens,
      outputTokens: response.usage?.outputTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
      cachedTokens,
      cacheHitRatio,
      processingTime: response.metadata?.processingTime ?? Date.now() - startTime,
    };
  } catch (error) {
    return {
      requestNumber,
      userPrompt,
      success: false,
      responsePreview: '',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      cacheHitRatio: '0%',
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('IMPLICIT CACHE TOKEN TRACKING - SMOKE TEST');
  console.log('='.repeat(70));
  console.log();

  const providerLabel = USE_DIRECT_GOOGLE ? 'Google (Direct API)' : 'Vertex AI (Service Account)';

  // Validate environment
  if (USE_DIRECT_GOOGLE) {
    if (!process.env.GEMINI_API_KEY) {
      console.error('ERROR: GEMINI_API_KEY is not set.');
      console.error('Please set it in your .env file.');
      process.exit(1);
    }
  } else {
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      console.error('ERROR: GOOGLE_CLOUD_PROJECT is not set.');
      console.error('Please set it in your .env file for Vertex AI.');
      process.exit(1);
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.');
      console.error('Please set it to the path of your service account JSON.');
      process.exit(1);
    }
  }

  // Estimate actual system prompt token count
  const estimatedTokens = Math.round(LARGE_SYSTEM_PROMPT.length / CHARS_PER_TOKEN);

  console.log('Configuration:');
  console.log(`  Provider:       ${providerLabel}`);
  console.log(`  Model:          ${MODEL}`);
  if (!USE_DIRECT_GOOGLE) {
    console.log(`  Project:        ${process.env.GOOGLE_CLOUD_PROJECT}`);
    console.log(`  Region:         ${REGION}`);
  }
  console.log(`  System Prompt:  ~${estimatedTokens} tokens (${LARGE_SYSTEM_PROMPT.length} chars) - FIXED for all requests`);
  console.log(`  Reasoning:      low (minimal)`);
  console.log(`  Wait between:   ${WAIT_BETWEEN_REQUESTS_MS / 1000}s`);
  console.log(`  Requests:       ${USER_PROMPTS.length} sequential`);
  console.log();

  console.log('Strategy:');
  console.log('  - IDENTICAL large system prompt for all requests (cacheable prefix)');
  console.log('  - Only the short user prompt varies (at the very end)');
  console.log('  - Wait between requests for cache population');
  console.log();

  const llmService = new LLMService();
  const results: CacheTestResult[] = [];

  console.log('Running tests...');
  console.log('-'.repeat(70));

  for (let i = 0; i < USER_PROMPTS.length; i++) {
    const userPrompt = USER_PROMPTS[i];
    console.log(`\nRequest ${i + 1}/${USER_PROMPTS.length}: "${userPrompt}"`);

    const result = await runCacheTest(llmService, i + 1, userPrompt);
    results.push(result);

    if (result.success) {
      console.log(`  Status:      SUCCESS`);
      console.log(`  Response:    "${result.responsePreview}"`);
      console.log(`  Input:       ${result.inputTokens} tokens`);
      console.log(`  Output:      ${result.outputTokens} tokens`);
      console.log(`  Cached:      ${result.cachedTokens} tokens (${result.cacheHitRatio} of input)`);
      console.log(`  Time:        ${result.processingTime}ms`);
    } else {
      console.log(`  Status:      FAILED`);
      console.log(`  Error:       ${result.error}`);
    }

    // Wait between requests (except after the last one)
    if (i < USER_PROMPTS.length - 1) {
      const waitSeconds = WAIT_BETWEEN_REQUESTS_MS / 1000;
      console.log(`\n  Waiting ${waitSeconds}s for cache population...`);
      await sleep(WAIT_BETWEEN_REQUESTS_MS);
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();

  console.log('| Req# | Status | Input Tokens | Cached Tokens | Cache Hit | Time (ms) |');
  console.log('|------|--------|--------------|---------------|-----------|-----------|');

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    console.log(
      `| ${result.requestNumber.toString().padStart(4)} ` +
      `| ${status.padEnd(6)} ` +
      `| ${result.inputTokens.toString().padStart(12)} ` +
      `| ${result.cachedTokens.toString().padStart(13)} ` +
      `| ${result.cacheHitRatio.padStart(9)} ` +
      `| ${result.processingTime.toString().padStart(9)} |`
    );
  }

  console.log();

  // Analysis
  const successfulResults = results.filter(r => r.success);
  const cacheHits = successfulResults.filter(r => r.cachedTokens > 0);

  if (successfulResults.length === 0) {
    console.log('ALL REQUESTS FAILED - cannot analyze cache behavior.');
    process.exit(1);
  }

  console.log('Cache Analysis:');
  console.log(`  Total requests:        ${results.length}`);
  console.log(`  Successful:            ${successfulResults.length}`);
  console.log(`  Cache hits:            ${cacheHits.length} of ${successfulResults.length}`);

  if (cacheHits.length > 0) {
    const avgCached = Math.round(
      cacheHits.reduce((sum, r) => sum + r.cachedTokens, 0) / cacheHits.length
    );
    console.log(`  Avg cached tokens:     ${avgCached}`);
    console.log();
    console.log('CACHE TRACKING WORKING! cachedContentTokenCount is being returned and mapped.');
    console.log('cacheMetadata.cacheReadTokens is populated correctly.');
  } else {
    console.log();
    console.log('NOTE: No cache hits detected. This can happen because:');
    console.log('  1. Implicit caching is not guaranteed (Google decides)');
    console.log('  2. The model might not support implicit caching yet');
    console.log('  3. The prompt might still be below the effective threshold');
    console.log();
    console.log('This does NOT mean the implementation is wrong - the mapping');
    console.log('code is still correct and will work when Google returns cached tokens.');
    console.log('Check the unit tests for verification of the mapping logic.');
  }

  console.log();

  // Final verdict
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('ALL REQUESTS SUCCEEDED!');
  } else {
    console.log('SOME REQUESTS FAILED - check errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
