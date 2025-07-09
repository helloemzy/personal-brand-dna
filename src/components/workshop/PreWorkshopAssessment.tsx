import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setAssessmentScore, setWorkshopPath } from '../../store/slices/workshopSlice';

interface AssessmentResponse {
  careerStage: string;
  purposeClarity: number;
  uniquenessClarity: number;
}

const PreWorkshopAssessment: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [responses, setResponses] = useState<AssessmentResponse>({
    careerStage: '',
    purposeClarity: 0,
    uniquenessClarity: 0
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const careerStages = [
    { value: 'early', label: 'Early Career (0-5 years)', description: 'Building expertise and finding your path' },
    { value: 'mid', label: 'Mid-Career (5-15 years)', description: 'Established professional seeking growth' },
    { value: 'senior', label: 'Senior Level (15+ years)', description: 'Experienced leader or expert' },
    { value: 'transition', label: 'Career Transition', description: 'Pivoting to a new direction' },
    { value: 'entrepreneur', label: 'Entrepreneur/Founder', description: 'Building your own venture' }
  ];

  const handleCareerStageSelect = (stage: string) => {
    setResponses({ ...responses, careerStage: stage });
    setCurrentQuestion(1);
  };

  const handleClaritySelect = (field: 'purposeClarity' | 'uniquenessClarity', value: number) => {
    const updatedResponses = { ...responses, [field]: value };
    setResponses(updatedResponses);

    if (field === 'purposeClarity') {
      setCurrentQuestion(2);
    } else {
      // Calculate assessment score and determine path
      calculatePathAndProceed(updatedResponses);
    }
  };

  const calculatePathAndProceed = (finalResponses: AssessmentResponse) => {
    // Calculate overall clarity score (0-100)
    const purposeScore = finalResponses.purposeClarity * 20; // 0-100
    const uniquenessScore = finalResponses.uniquenessClarity * 20; // 0-100
    const averageScore = (purposeScore + uniquenessScore) / 2;

    // Determine workshop path based on score
    let workshopPath: 'direct' | 'discovery' | 'hybrid';
    if (averageScore >= 80) {
      workshopPath = 'direct'; // High clarity - streamlined questions
    } else if (averageScore <= 40) {
      workshopPath = 'discovery'; // Low clarity - story-based exploration
    } else {
      workshopPath = 'hybrid'; // Mixed - combination approach
    }

    // Store assessment results
    dispatch(setAssessmentScore(averageScore));
    dispatch(setWorkshopPath(workshopPath));

    // Navigate to workshop with personalized welcome
    navigate('/brand-house', { 
      state: { 
        fromAssessment: true, 
        clarityScore: averageScore,
        path: workshopPath 
      } 
    });
  };

  const renderCareerStageQuestion = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Let's start with where you are in your journey
        </h2>
        <p className="text-gray-600">
          This helps us tailor the workshop to your specific needs
        </p>
      </div>

      <div className="space-y-3">
        {careerStages.map((stage) => (
          <button
            key={stage.value}
            onClick={() => handleCareerStageSelect(stage.value)}
            className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all group"
          >
            <div className="font-semibold text-gray-900 group-hover:text-purple-700">
              {stage.label}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {stage.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderClarityScale = (
    title: string,
    description: string,
    field: 'purposeClarity' | 'uniquenessClarity'
  ) => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Not clear at all</span>
          <span>Crystal clear</span>
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((value) => {
            const labels = [
              "I'm still figuring it out",
              "I have some ideas but they're fuzzy",
              "I'm getting clearer but not quite there",
              "I'm pretty clear with some gaps",
              "I know exactly what I'm about"
            ];
            
            return (
              <button
                key={value}
                onClick={() => handleClaritySelect(field, value)}
                className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 group-hover:text-purple-700">
                    {labels[value - 1]}
                  </span>
                  <span className="text-2xl font-bold text-gray-400 group-hover:text-purple-600">
                    {value}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const questions = [
    () => renderCareerStageQuestion(),
    () => renderClarityScale(
      "How clear are you on your professional purpose?",
      "Your 'why' - the impact you want to make through your work",
      'purposeClarity'
    ),
    () => renderClarityScale(
      "How well can you articulate what makes you unique?",
      "Your special sauce - what sets you apart from others in your field",
      'uniquenessClarity'
    )
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Question {currentQuestion + 1} of 3
              </span>
              <button
                onClick={() => navigate('/brand-house')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip assessment
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Question content */}
          {questions[currentQuestion]()}
        </div>

        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>This 3-question assessment helps us personalize your workshop experience</p>
          <p className="mt-1">Takes less than 30 seconds</p>
        </div>
      </div>
    </div>
  );
};

export default PreWorkshopAssessment;