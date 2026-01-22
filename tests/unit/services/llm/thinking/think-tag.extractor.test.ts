import { ThinkTagExtractor } from '../../../../../src/middleware/services/llm/thinking';

describe('ThinkTagExtractor', () => {
  let extractor: ThinkTagExtractor;

  beforeEach(() => {
    extractor = new ThinkTagExtractor();
  });

  describe('name property', () => {
    it('should have name "think-tags"', () => {
      expect(extractor.name).toBe('think-tags');
    });
  });

  describe('extract with <think> tags', () => {
    it('should extract content from <think> tags', () => {
      const input = '<think>This is my reasoning</think>The actual answer';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('This is my reasoning');
      expect(result.content).toBe('The actual answer');
    });

    it('should handle multiline thinking content', () => {
      const input = `<think>
Step 1: Analyze the problem
Step 2: Consider options
Step 3: Decide
</think>
The final answer is 42.`;
      const result = extractor.extract(input);

      expect(result.thinking).toContain('Step 1: Analyze the problem');
      expect(result.thinking).toContain('Step 2: Consider options');
      expect(result.thinking).toContain('Step 3: Decide');
      expect(result.content).toBe('The final answer is 42.');
    });

    it('should handle multiple <think> tags', () => {
      const input = '<think>First thought</think>Part one<think>Second thought</think>Part two';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('First thought\n\nSecond thought');
      expect(result.content).toBe('Part onePart two');
    });

    it('should be case-insensitive', () => {
      const input = '<THINK>UPPERCASE</THINK>Content<Think>Mixed</Think>More';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('UPPERCASE\n\nMixed');
      expect(result.content).toBe('ContentMore');
    });
  });

  describe('extract with <thinking> tags', () => {
    it('should extract content from <thinking> tags', () => {
      const input = '<thinking>My analysis here</thinking>The result';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('My analysis here');
      expect(result.content).toBe('The result');
    });
  });

  describe('extract with <reasoning> tags', () => {
    it('should extract content from <reasoning> tags', () => {
      const input = '<reasoning>Logical steps</reasoning>Conclusion';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('Logical steps');
      expect(result.content).toBe('Conclusion');
    });
  });

  describe('extract with mixed tag types', () => {
    it('should handle all tag types in same content', () => {
      const input = '<think>T1</think><thinking>T2</thinking><reasoning>T3</reasoning>Final';
      const result = extractor.extract(input);

      expect(result.thinking).toContain('T1');
      expect(result.thinking).toContain('T2');
      expect(result.thinking).toContain('T3');
      expect(result.content).toBe('Final');
    });
  });

  describe('extract with no thinking tags', () => {
    it('should return undefined thinking when no tags present', () => {
      const input = 'Just plain content without any thinking tags';
      const result = extractor.extract(input);

      expect(result.thinking).toBeUndefined();
      expect(result.content).toBe(input);
    });

    it('should handle empty string', () => {
      const result = extractor.extract('');

      expect(result.thinking).toBeUndefined();
      expect(result.content).toBe('');
    });
  });

  describe('extract with JSON content', () => {
    it('should preserve JSON structure in content', () => {
      const json = '{"title": "Test", "chapters": [1, 2, 3]}';
      const input = `<think>Generating story structure...</think>${json}`;
      const result = extractor.extract(input);

      expect(result.thinking).toBe('Generating story structure...');
      expect(result.content).toBe(json);

      // Verify JSON is valid
      const parsed = JSON.parse(result.content);
      expect(parsed.title).toBe('Test');
      expect(parsed.chapters).toEqual([1, 2, 3]);
    });

    it('should handle complex JSON with nested objects', () => {
      const json = JSON.stringify({
        story: {
          title: 'Adventure',
          pages: [
            { number: 1, text: 'Once upon a time' },
            { number: 2, text: 'The end' }
          ]
        }
      }, null, 2);

      const input = `<think>
I need to create a story with proper structure.
Let me think about the plot...
</think>
${json}`;

      const result = extractor.extract(input);

      expect(result.thinking).toContain('I need to create a story');
      expect(result.thinking).toContain('Let me think about the plot');

      const parsed = JSON.parse(result.content);
      expect(parsed.story.title).toBe('Adventure');
      expect(parsed.story.pages).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty thinking tags', () => {
      const input = '<think></think>Content';
      const result = extractor.extract(input);

      expect(result.thinking).toBeUndefined();
      expect(result.content).toBe('Content');
    });

    it('should handle thinking tags with only whitespace', () => {
      const input = '<think>   </think>Content';
      const result = extractor.extract(input);

      expect(result.thinking).toBeUndefined();
      expect(result.content).toBe('Content');
    });

    it('should handle nested-looking content (not actually nested)', () => {
      const input = '<think>User wants <code> blocks explained</think>Here is the explanation';
      const result = extractor.extract(input);

      expect(result.thinking).toBe('User wants <code> blocks explained');
      expect(result.content).toBe('Here is the explanation');
    });
  });
});
