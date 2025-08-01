export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Mocked AI response for testing purposes. This is a sample content generated by the mock OpenAI service.',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      })
    }
  },
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{
        embedding: new Array(1536).fill(0).map(() => Math.random())
      }],
      usage: {
        prompt_tokens: 10,
        total_tokens: 10
      }
    })
  }
};

export const createMockOpenAI = () => {
  return mockOpenAI;
};