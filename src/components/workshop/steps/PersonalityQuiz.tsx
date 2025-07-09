import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Brain, CheckCircle, Target, Lightbulb, ArrowRight } from 'lucide-react';
import { 
  selectWorkshopState,
  answerQuizQuestion,
  QuizResponse
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';

// Types for different question categories
type QuestionType = 'personality' | 'professional' | 'mission';

interface QuizQuestionType {
  id: string;
  type: QuestionType;
  question: string;
  subtext?: string;
  options?: Array<{
    value: string;
    text: string;
    dimension?: string;
  }>;
  inputType?: 'text' | 'textarea' | 'select';
  placeholder?: string;
}

// Quiz questions with personality dimensions
const personalityQuestions: QuizQuestionType[] = [
  {
    id: 'q1',
    type: 'personality',
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

// Professional identity questions
const professionalQuestions: QuizQuestionType[] = [
  {
    id: 'prof1',
    type: 'professional',
    question: "What's your current professional role?",
    subtext: "Be specific about your title and main responsibilities",
    inputType: 'text',
    placeholder: 'e.g., Senior Product Manager at Tech Startup'
  },
  {
    id: 'prof2',
    type: 'professional',
    question: 'How many years of professional experience do you have?',
    subtext: 'Include relevant experience in your field',
    inputType: 'select',
    options: [
      { value: '0-2', text: '0-2 years (Early Career)' },
      { value: '3-5', text: '3-5 years (Developing Professional)' },
      { value: '6-10', text: '6-10 years (Experienced Professional)' },
      { value: '11-15', text: '11-15 years (Senior Professional)' },
      { value: '16-20', text: '16-20 years (Seasoned Expert)' },
      { value: '20+', text: '20+ years (Industry Veteran)' }
    ]
  },
  {
    id: 'prof3',
    type: 'professional',
    question: "What are you professionally known for?",
    subtext: "What do colleagues or clients consistently come to you for?",
    inputType: 'textarea',
    placeholder: 'e.g., I\'m the go-to person for turning complex data into actionable insights that drive business decisions'
  },
  {
    id: 'prof4',
    type: 'professional',
    question: "What's one controversial or unpopular opinion you hold about your industry?",
    subtext: "Something you believe strongly but others might disagree with",
    inputType: 'textarea',
    placeholder: 'e.g., I believe remote work has made most corporate offices obsolete and companies clinging to them will lose top talent'
  }
];

// Mission builder questions
const missionQuestions: QuizQuestionType[] = [
  {
    id: 'mission1',
    type: 'mission',
    question: 'How clear are you on your professional mission?',
    subtext: 'This helps us determine the best path for you',
    options: [
      { value: 'very-clear', text: 'Crystal clear - I know exactly what I want to achieve' },
      { value: 'somewhat-clear', text: 'Somewhat clear - I have a general direction but need refinement' },
      { value: 'exploring', text: 'Still exploring - I need help discovering my mission' }
    ]
  },
  {
    id: 'mission2',
    type: 'mission',
    question: 'If you have a mission in mind, what is it?',
    subtext: 'Write it in your own words, even if it\'s not perfect',
    inputType: 'textarea',
    placeholder: 'e.g., I help overwhelmed entrepreneurs build sustainable businesses through systems that create freedom'
  },
  {
    id: 'mission3',
    type: 'mission',
    question: 'What change do you want to create in the world?',
    subtext: 'Think big - what would you change if you could?',
    inputType: 'textarea',
    placeholder: 'e.g., I want to make quality education accessible to every child regardless of their economic background'
  },
  {
    id: 'mission4',
    type: 'mission',
    question: 'Who do you feel most called to help?',
    subtext: 'Be specific about the people you want to serve',
    inputType: 'textarea',
    placeholder: 'e.g., First-generation entrepreneurs who are brilliant at their craft but struggle with business operations'
  }
];

// Combine all questions with type indicators
const allQuestions = [
  ...personalityQuestions.map(q => ({ ...q, type: 'personality' as QuestionType })),
  ...professionalQuestions,
  ...missionQuestions
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
  question: QuizQuestionType;
  questionNumber: number;
  onAnswer: (answer: string) => void;
  previousAnswer?: string;
}> = ({ question, questionNumber, onAnswer, previousAnswer }) => {
  const [selectedOption, setSelectedOption] = useState(previousAnswer || '');
  const [textAnswer, setTextAnswer] = useState(previousAnswer || '');
  
  const handleSelect = (value: string) => {
    setSelectedOption(value);
    setTimeout(() => onAnswer(value), 300); // Brief delay for visual feedback
  };
  
  const handleTextSubmit = () => {
    if (textAnswer.trim()) {
      onAnswer(textAnswer);
    }
  };
  
  // Get section header based on question type
  const getSectionHeader = () => {
    if (question.type === 'professional' && question.id === 'prof1') {
      return (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg">
          <div className="flex items-center">
            <Target className="w-5 h-5 text-purple-600 mr-2" />
            <h4 className="font-semibold text-purple-900">Professional Identity</h4>
          </div>
          <p className="text-sm text-purple-700 mt-1">
            Let's understand your professional background and expertise
          </p>
        </div>
      );
    }
    if (question.type === 'mission' && question.id === 'mission1') {
      return (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center">
            <Lightbulb className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-semibold text-green-900">Mission Discovery</h4>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Let's clarify your professional mission and purpose
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="animate-fadeIn">
      {getSectionHeader()}
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {questionNumber}. {question.question}
      </h3>
      {question.subtext && (
        <p className="text-sm text-gray-600 mb-6">{question.subtext}</p>
      )}
      
      {/* Multiple choice questions */}
      {question.options && (
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
      )}
      
      {/* Text input questions */}
      {question.inputType === 'text' && (
        <div className="space-y-4">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder={question.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && textAnswer.trim()) {
                handleTextSubmit();
              }
            }}
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textAnswer.trim()}
            className={`
              w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center
              ${textAnswer.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      )}
      
      {/* Textarea questions */}
      {question.inputType === 'textarea' && (
        <div className="space-y-4">
          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder={question.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textAnswer.trim()}
            className={`
              w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center
              ${textAnswer.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      )}
    </div>
  );
};

// Quiz results summary
const QuizResults: React.FC<{ responses: QuizResponse[] }> = ({ responses }) => {
  // Calculate personality profile based on personality questions only
  const dimensionCounts: Record<string, number> = {};
  const personalityResponses = responses.filter(r => r.questionId.startsWith('q'));
  
  personalityResponses.forEach((response) => {
    const question = personalityQuestions.find(q => q.id === response.questionId);
    const selectedOption = question?.options?.find(opt => opt.value === response.answer);
    if (selectedOption?.dimension) {
      dimensionCounts[selectedOption.dimension] = (dimensionCounts[selectedOption.dimension] || 0) + 1;
    }
  });
  
  const topDimensions = Object.entries(dimensionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  // Extract professional and mission data
  const professionalData = responses.filter(r => r.questionId.startsWith('prof'));
  const missionData = responses.filter(r => r.questionId.startsWith('mission'));
  
  return (
    <div className="text-center py-8">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete!</h3>
      <p className="text-gray-600 mb-6">
        We've analyzed your responses to create your personalized brand profile.
      </p>
      
      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Communication Profile */}
        <div className="bg-gray-50 rounded-lg p-6 text-left">
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
                  {Math.round((count / personalityResponses.length) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Professional Identity Summary */}
        {professionalData.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-6 text-left">
            <h4 className="font-medium text-purple-900 mb-3">Professional Identity Captured</h4>
            <p className="text-sm text-purple-700">
              We've recorded your professional background, expertise, and unique perspective.
              This will help shape your authentic brand voice.
            </p>
          </div>
        )}
        
        {/* Mission Summary */}
        {missionData.length > 0 && (
          <div className="bg-green-50 rounded-lg p-6 text-left">
            <h4 className="font-medium text-green-900 mb-3">Mission & Purpose Defined</h4>
            <p className="text-sm text-green-700">
              Your mission clarity and aspirations have been captured. 
              We'll use this to create a compelling brand narrative.
            </p>
          </div>
        )}
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
  const currentQuestion = allQuestions[currentQuestionIndex];
  const isComplete = currentQuestionIndex >= allQuestions.length;
  
  const handleAnswer = (answer: string) => {
    const response: QuizResponse = {
      questionId: currentQuestion.id,
      answer,
      answeredAt: new Date().toISOString()
    };
    
    dispatch(answerQuizQuestion(response));
    
    // Check if quiz is complete
    if (currentQuestionIndex === allQuestions.length - 1) {
      setTimeout(() => setShowResults(true), 500);
    }
  };
  
  if (isComplete || showResults) {
    return <QuizResults responses={personalityQuiz.responses} />;
  }
  
  // Adaptive mission path: Skip mission questions if user is very clear
  const missionClarity = personalityQuiz.responses.find(r => r.questionId === 'mission1')?.answer;
  if (missionClarity === 'very-clear' && currentQuestion?.id === 'mission3') {
    // Skip to next question automatically
    handleAnswer('skipped');
    return null;
  }
  
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Brain className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Complete Brand Assessment
        </h2>
        <p className="text-gray-600">
          Let's understand your communication style, professional identity, and mission.
        </p>
      </div>
      
      <QuizProgress 
        current={currentQuestionIndex + 1} 
        total={allQuestions.length} 
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
        {currentQuestion?.inputType ? (
          <p>Press Enter or click Continue when ready</p>
        ) : (
          <p>Select an option to automatically proceed to the next question</p>
        )}
      </div>
    </div>
  );
};

export default PersonalityQuiz;