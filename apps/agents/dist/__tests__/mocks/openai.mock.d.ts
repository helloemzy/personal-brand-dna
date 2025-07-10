export declare const mockOpenAI: {
    chat: {
        completions: {
            create: jest.Mock<any, any, any>;
        };
    };
    embeddings: {
        create: jest.Mock<any, any, any>;
    };
};
export declare const createMockOpenAI: () => {
    chat: {
        completions: {
            create: jest.Mock<any, any, any>;
        };
    };
    embeddings: {
        create: jest.Mock<any, any, any>;
    };
};
