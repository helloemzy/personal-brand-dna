export declare const mockWorkshopData: {
    userId: string;
    archetype: string;
    values: string[];
    personalityTraits: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    writingSamples: {
        text: string;
        pillar: string;
    }[];
    mission: string;
    contentPillars: {
        name: string;
        percentage: number;
        topics: string[];
    }[];
    voiceProfile: {
        tone: string;
        style: string;
        vocabulary: string[];
        sentenceStructure: string;
    };
};
export declare const mockNewsItem: {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    source: string;
    relevanceScore: number;
    categories: string[];
};
export declare const mockContentRequest: {
    userId: string;
    sourceType: "news";
    sourceContent: {
        title: string;
        description: string;
        link: string;
        pubDate: string;
        source: string;
        relevanceScore: number;
        categories: string[];
    };
    angle: "thought-leader";
    pillar: string;
    requestedBy: string;
};
