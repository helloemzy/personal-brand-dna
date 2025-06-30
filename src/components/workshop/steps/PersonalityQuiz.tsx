import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Brain, CheckCircle } from 'lucide-react';
import { 
  selectWorkshopState,
  answerQuizQuestion,
  QuizResponse
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';

// Quiz questions with personality dimensions
const quizQuestions = [
  {
    id: 'q1',
    question: 'When presenting an idea to colleagues, I prefer to:',
    options: [
      { value: 'a', text: 'Start with data and evidence to build my case', dimension: 'analytical' },
      { value: 'b', text: 'Tell a story that illustrates the concept', dimension: 'creative' },
      { value: 'c', text: 'Get straight to the point with key takeaways', dimension: 'concise' },
      { value: 'd', text: 'Provide comprehensive context and background', dimension: 'detailed' }
    ]
  },
  {
    id: 'q2',
    question: 'My ideal work environment is one where:',
    options: [
      { value: 'a', text: 'Structure and processes are clearly defined', dimension: 'formal' },
      { value: 'b', text: 'Flexibility and adaptability are valued', dimension: 'casual' },
      { value: 'c', text: 'Innovation and experimentation are encouraged', dimension: 'creative' },
      { value: 'd', text: 'Results and efficiency are the top priorities', dimension: 'analytical' }
    ]
  },
  {
    id: 'q3',
    question: 'When facing a challenge, my first instinct is to:',
    options: [
      { value: 'a', text: 'Analyze all available data before acting', dimension: 'analytical' },
      { value: 'b', text: 'Brainstorm creative solutions with others', dimension: 'creative' },
      { value: 'c', text: 'Develop a systematic plan of action', dimension: 'formal' },
      { value: 'd', text: 'Trust my intuition and experience', dimension: 'casual' }
    ]
  },
  {
    id: 'q4',
    question: 'In professional communications, I believe:',
    options: [
      { value: 'a', text: 'Brevity is essential - less is more', dimension: 'concise' },
      { value: 'b', text: 'Context is crucial - more information is better', dimension: 'detailed' },
      { value: 'c', text: 'Personality adds value - be authentic', dimension: 'playful' },
      { value: 'd', text: 'Professionalism is key - maintain boundaries', dimension: 'serious' }
    ]
  },
  {
    id: 'q5',
    question: 'When learning something new, I prefer:',
    options: [
      { value: 'a', text: 'Step-by-step tutorials with clear instructions', dimension: 'formal' },
      { value: 'b', text: 'Hands-on experimentation and trial-and-error', dimension: 'casual' },
      { value: 'c', text: 'Visual aids, diagrams, and creative examples', dimension: 'creative' },
      { value: 'd', text: 'Research papers and detailed documentation', dimension: 'analytical' }
    ]
  },
  {
    id: 'q6',
    question: 'My approach to networking is:',
    options: [
      { value: 'a', text: 'Building genuine friendships and casual connections', dimension: 'playful' },
      { value: 'b', text: 'Strategic relationship building for mutual benefit', dimension: 'serious' },
      { value: 'c', text: 'Sharing knowledge and expertise generously', dimension: 'detailed' },
      { value: 'd', text: 'Making memorable first impressions quickly', dimension: 'concise' }
    ]
  },
  {
    id: 'q7',
    question: 'When giving feedback, I tend to:',
    options: [
      { value: 'a', text: 'Be direct and focus on specific improvements', dimension: 'concise' },
      { value: 'b', text: 'Provide thorough analysis with examples', dimension: 'detailed' },
      { value: 'c', text: 'Use humor and positivity to soften criticism', dimension: 'playful' },
      { value: 'd', text: 'Maintain professional distance and objectivity', dimension: 'serious' }
    ]
  },
  {
    id: 'q8',
    question: 'My decision-making style is best described as:',
    options: [
      { value: 'a', text: 'Data-driven and methodical', dimension: 'analytical' },
      { value: 'b', text: 'Intuitive and imaginative', dimension: 'creative' },
      { value: 'c', text: 'Structured and process-oriented', dimension: 'formal' },
      { value: 'd', text: 'Flexible and adaptable', dimension: 'casual' }
    ]
  },
  {
    id: 'q9',
    question: 'In team meetings, I usually:',
    options: [
      { value: 'a', text: 'Come prepared with detailed notes and agenda items', dimension: 'detailed' },
      { value: 'b', text: 'Keep contributions brief and action-focused', dimension: 'concise' },
      { value: 'c', text: 'Inject energy and enthusiasm into discussions', dimension: 'playful' },
      { value: 'd', text: 'Focus on objectives and measurable outcomes', dimension: 'serious' }
    ]
  },
  {
    id: 'q10',
    question: 'My ideal LinkedIn post would:',
    options: [
      { value: 'a', text: 'Share a data-backed insight or case study', dimension: 'analytical' },
      { value: 'b', text: 'Tell an inspiring personal story or journey', dimension: 'creative' },
      { value: 'c', text: 'Provide a quick tip or actionable advice', dimension: 'concise' },
      { value: 'd', text: 'Offer a comprehensive guide or analysis', dimension: 'detailed' }
    ]
  }
];

// Progress indicator for quiz
const QuizProgress: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const progress = (current / total) * 100;
  
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Question {current} of {total}</span>
        <span>{Math.round(progress)}% Complete</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Question display component
const QuizQuestion: React.FC<{
  question: typeof quizQuestions[0];
  questionNumber: number;
  onAnswer: (answer: string) => void;
  previousAnswer?: string;
}> = ({ question, questionNumber, onAnswer, previousAnswer }) => {
  const [selectedOption, setSelectedOption] = useState(previousAnswer || '');
  
  const handleSelect = (value: string) => {
    setSelectedOption(value);
    setTimeout(() => onAnswer(value), 300); // Brief delay for visual feedback
  };
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        {questionNumber}. {question.question}
      </h3>
      
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`
              w-full text-left p-4 rounded-lg border-2 transition-all
              ${selectedOption === option.value
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-center">
              <div className={`
                w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center
                ${selectedOption === option.value 
                  ? 'border-blue-600 bg-blue-600' 
                  : 'border-gray-300'
                }
              `}>
                {selectedOption === option.value && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <span className="flex-1">{option.text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Quiz results summary
const QuizResults: React.FC<{ responses: QuizResponse[] }> = ({ responses }) => {
  // Calculate personality profile based on responses
  const dimensionCounts: Record<string, number> = {};
  
  responses.forEach((response) => {
    const question = quizQuestions.find(q => q.id === response.questionId);
    const selectedOption = question?.options.find(opt => opt.value === response.answer);
    if (selectedOption) {
      dimensionCounts[selectedOption.dimension] = (dimensionCounts[selectedOption.dimension] || 0) + 1;
    }
  });
  
  const topDimensions = Object.entries(dimensionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  return (
    <div className="text-center py-8">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h3>
      <p className="text-gray-600 mb-6">
        We've analyzed your responses to understand your communication preferences.
      </p>
      
      <div className="bg-gray-50 rounded-lg p-6 text-left max-w-md mx-auto">
        <h4 className="font-medium text-gray-900 mb-3">Your Communication Profile:</h4>
        <div className="space-y-2">
          {topDimensions.map(([dimension, count], index) => (
            <div key={dimension} className="flex items-center">
              <span className={`
                inline-block w-8 h-8 rounded-full text-white text-sm font-medium
                flex items-center justify-center mr-3
                ${index === 0 ? 'bg-blue-600' : index === 1 ? 'bg-blue-500' : 'bg-blue-400'}
              `}>
                {index + 1}
              </span>
              <span className="capitalize font-medium">{dimension}</span>
              <span className="ml-auto text-gray-600">
                {Math.round((count / responses.length) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main component
const PersonalityQuiz: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { personalityQuiz } = useSelector(selectWorkshopState);
  const [showResults, setShowResults] = useState(false);
  
  const currentQuestionIndex = personalityQuiz.currentQuestionIndex;
  const currentQuestion = quizQuestions[currentQuestionIndex];
  const isComplete = currentQuestionIndex >= quizQuestions.length;
  
  const handleAnswer = (answer: string) => {
    const response: QuizResponse = {
      questionId: currentQuestion.id,
      answer,
      answeredAt: new Date()
    };
    
    dispatch(answerQuizQuestion(response));
    
    // Check if quiz is complete
    if (currentQuestionIndex === quizQuestions.length - 1) {
      setTimeout(() => setShowResults(true), 500);
    }
  };
  
  if (isComplete || showResults) {
    return <QuizResults responses={personalityQuiz.responses} />;
  }
  
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Brain className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Personality & Style Assessment
        </h2>
        <p className="text-gray-600">
          Answer these quick questions to help us understand your communication preferences 
          and personality traits.
        </p>
      </div>
      
      <QuizProgress 
        current={currentQuestionIndex + 1} 
        total={quizQuestions.length} 
      />
      
      <div className="bg-white rounded-xl shadow-sm p-8">
        {currentQuestion && (
          <QuizQuestion
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            onAnswer={handleAnswer}
            previousAnswer={
              personalityQuiz.responses.find(r => r.questionId === currentQuestion.id)?.answer
            }
          />
        )}
      </div>
      
      {/* Navigation hint */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Select an option to automatically proceed to the next question</p>
      </div>
    </div>
  );
};

export default PersonalityQuiz;