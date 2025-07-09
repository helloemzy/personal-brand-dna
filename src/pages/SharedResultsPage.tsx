import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Award, 
  Target, 
  Layers,
  ArrowRight,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { getShareData, preparePublicShareData } from '../services/sharingService';

const SharedResultsPage: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [publicData, setPublicData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadShareData = async () => {
      if (!shareCode) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const shareData = getShareData(shareCode);
        
        if (!shareData) {
          setError('This share link has expired or does not exist');
          setLoading(false);
          return;
        }

        const publicShareData = preparePublicShareData(shareData);
        setPublicData(publicShareData);
      } catch (error) {
        console.error('Error loading share data:', error);
        setError('Unable to load shared results');
      } finally {
        setLoading(false);
      }
    };

    loadShareData();
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="animate-pulse text-blue-600 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Brand House...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="text-red-500 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/brand-house')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Your Own Brand House
          </button>
        </div>
      </div>
    );
  }

  if (!publicData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">BrandPillar AI</h1>
            <button
              onClick={() => navigate('/brand-house')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Create Your Own →
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Archetype Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
            <Award className="text-blue-600" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            {publicData.archetype}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {publicData.archetypeDescription}
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {Math.round(publicData.confidence * 100)}% Confidence
            </span>
          </div>
        </div>

        {/* Mission Section */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center mb-4">
            <Target className="text-gray-700 mr-3" size={24} />
            <h3 className="text-2xl font-bold text-gray-900">Mission</h3>
          </div>
          <p className="text-lg text-gray-700 italic">
            "{publicData.mission}"
          </p>
        </div>

        {/* Values Section */}
        {publicData.values && publicData.values.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Core Values</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {publicData.values.map((value: string, index: number) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium"
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content Pillars Section */}
        {publicData.contentPillars && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <div className="flex items-center mb-6">
              <Layers className="text-gray-700 mr-3" size={24} />
              <h3 className="text-2xl font-bold text-gray-900">Content Pillars</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {publicData.contentPillars.map((pillar: any, index: number) => (
                <div key={index} className="text-center">
                  <h4 className="font-semibold text-gray-900 mb-2">{pillar.name}</h4>
                  <p className="text-3xl font-bold text-blue-600 mb-2">{pillar.percentage}%</p>
                  <p className="text-sm text-gray-600">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-4">
            Discover Your Brand Archetype
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Take the AI-powered Brand House workshop and get clarity on your professional brand in just 15 minutes.
          </p>
          <button
            onClick={() => navigate('/brand-house')}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
          >
            Start Your Workshop
            <ArrowRight size={20} />
          </button>
          <p className="text-sm mt-4 opacity-75">
            Free • No credit card required • 15 minutes
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Shared via BrandPillar AI • Professional Brand Discovery Platform</p>
        </div>
      </div>
    </div>
  );
};

export default SharedResultsPage;