import React from 'react';
import { Clock, MessageSquare, Users, Coffee } from 'lucide-react';

interface ElevatorPitch {
  duration: string;
  context: string;
  pitch: string;
  keyPoints: string[];
  wordCount: number;
}

interface ElevatorPitchesProps {
  pitches: ElevatorPitch[];
  selectedDuration: string;
  onDurationChange: (duration: string) => void;
}

const ElevatorPitches: React.FC<ElevatorPitchesProps> = ({
  pitches,
  selectedDuration,
  onDurationChange
}) => {
  const durationIcons = {
    '30-second': Clock,
    '60-second': MessageSquare,
    'networking': Users,
    'coffee-chat': Coffee
  };

  const getDurationLabel = (duration: string) => {
    const labels: Record<string, string> = {
      '30-second': '30-Second Pitch',
      '60-second': '60-Second Pitch',
      'networking': 'Networking Event',
      'coffee-chat': 'Coffee Chat'
    };
    return labels[duration] || duration;
  };

  const selectedPitch = pitches.find(p => p.duration === selectedDuration) || pitches[0];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <MessageSquare className="w-5 h-5 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Elevator Pitches</h3>
      </div>

      {/* Duration selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select pitch duration:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {pitches.map((pitch) => {
            const Icon = durationIcons[pitch.duration as keyof typeof durationIcons] || Clock;
            return (
              <button
                key={pitch.duration}
                onClick={() => onDurationChange(pitch.duration)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedDuration === pitch.duration
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {getDurationLabel(pitch.duration)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected pitch display */}
      {selectedPitch && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-purple-700">
                {getDurationLabel(selectedPitch.duration)} • {selectedPitch.context}
              </span>
              <span className="text-sm text-gray-600">
                ~{selectedPitch.wordCount} words
              </span>
            </div>
            
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
              {selectedPitch.pitch}
            </p>

            {/* Key points */}
            <div className="mt-6 pt-4 border-t border-purple-100">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Points:</h4>
              <ul className="space-y-1">
                {selectedPitch.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span className="text-sm text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tips section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              💡 Pro Tips for {getDurationLabel(selectedPitch.duration)}:
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {selectedPitch.duration === '30-second' && (
                <>
                  <li>• Practice until it feels natural, not memorized</li>
                  <li>• Focus on one key outcome or transformation</li>
                  <li>• End with a question to start a conversation</li>
                </>
              )}
              {selectedPitch.duration === '60-second' && (
                <>
                  <li>• Include a brief story or example</li>
                  <li>• Mention 2-3 specific achievements</li>
                  <li>• Leave room for follow-up questions</li>
                </>
              )}
              {selectedPitch.duration === 'networking' && (
                <>
                  <li>• Lead with what's interesting, not just your title</li>
                  <li>• Make it relevant to the event or audience</li>
                  <li>• Have a business card ready to share</li>
                </>
              )}
              {selectedPitch.duration === 'coffee-chat' && (
                <>
                  <li>• Keep it conversational and relaxed</li>
                  <li>• Show genuine interest in the other person</li>
                  <li>• Have specific examples ready to share</li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElevatorPitches;