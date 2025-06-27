import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Info, RefreshCw } from 'lucide-react';
import { 
  selectWorkshopState,
  updateTonePreference,
  setTonePreset,
  TonePreferences as TonePreferencesType
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';

// Dimension descriptions for user guidance
const dimensionInfo = {
  formal_casual: {
    left: { label: 'Formal', description: 'Professional, structured, traditional' },
    right: { label: 'Casual', description: 'Conversational, relaxed, approachable' }
  },
  concise_detailed: {
    left: { label: 'Concise', description: 'Brief, to-the-point, efficient' },
    right: { label: 'Detailed', description: 'Comprehensive, thorough, explanatory' }
  },
  analytical_creative: {
    left: { label: 'Analytical', description: 'Data-driven, logical, systematic' },
    right: { label: 'Creative', description: 'Innovative, imaginative, expressive' }
  },
  serious_playful: {
    left: { label: 'Serious', description: 'Professional, focused, earnest' },
    right: { label: 'Playful', description: 'Light-hearted, engaging, fun' }
  }
};

// Preset tone profiles
const tonePresets = [
  {
    name: 'Executive Leader',
    description: 'Formal, concise, analytical communication style',
    values: { formal_casual: -30, concise_detailed: -20, analytical_creative: -25, serious_playful: -35 }
  },
  {
    name: 'Creative Professional',
    description: 'Balanced with creative flair and approachability',
    values: { formal_casual: 10, concise_detailed: 0, analytical_creative: 30, serious_playful: 15 }
  },
  {
    name: 'Thought Leader',
    description: 'Detailed, analytical insights with accessibility',
    values: { formal_casual: -10, concise_detailed: 25, analytical_creative: -15, serious_playful: -10 }
  },
  {
    name: 'Startup Founder',
    description: 'Casual, creative, and engaging communication',
    values: { formal_casual: 25, concise_detailed: -10, analytical_creative: 20, serious_playful: 20 }
  }
];

// Slider component for individual dimension
const ToneSlider: React.FC<{
  dimension: keyof TonePreferencesType;
  value: number;
  onChange: (value: number) => void;
}> = ({ dimension, value, onChange }) => {
  const info = dimensionInfo[dimension];
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Calculate position for the value indicator
  const position = ((value + 50) / 100) * 100;
  
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {info.left.label} ← → {info.right.label}
          </h3>
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="ml-2 text-gray-400 hover:text-gray-600 relative"
          >
            <Info className="w-4 h-4" />
            {showTooltip && (
              <div className="absolute left-0 top-6 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10">
                <div className="mb-2">
                  <strong>{info.left.label}:</strong> {info.left.description}
                </div>
                <div>
                  <strong>{info.right.label}:</strong> {info.right.description}
                </div>
              </div>
            )}
          </button>
        </div>
        <span className="text-sm font-medium text-blue-600">
          {value > 0 ? '+' : ''}{value}
        </span>
      </div>
      
      <div className="relative">
        {/* Slider track */}
        <div className="h-2 bg-gray-200 rounded-full relative">
          {/* Center line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-400" />
          
          {/* Active track */}
          <div 
            className="absolute top-0 h-full bg-blue-600 rounded-full transition-all duration-200"
            style={{
              left: value < 0 ? `${position}%` : '50%',
              right: value > 0 ? `${100 - position}%` : '50%'
            }}
          />
          
          {/* Slider handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-pointer transition-all duration-200 hover:scale-110"
            style={{ left: `calc(${position}% - 10px)` }}
          />
        </div>
        
        {/* Slider input (invisible, for interaction) */}
        <input
          type="range"
          min="-50"
          max="50"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        
        {/* Labels */}
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>{info.left.label}</span>
          <span className="text-gray-400">Balanced</span>
          <span>{info.right.label}</span>
        </div>
      </div>
    </div>
  );
};

// Main component
const TonePreferences: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tonePreferences } = useSelector(selectWorkshopState);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  
  const handleSliderChange = (dimension: keyof TonePreferencesType, value: number) => {
    dispatch(updateTonePreference({ dimension, value }));
    setSelectedPreset(null); // Clear preset selection when manually adjusting
  };
  
  const handlePresetSelect = (preset: typeof tonePresets[0]) => {
    setSelectedPreset(preset.name);
    dispatch(setTonePreset(preset.values));
  };
  
  const resetToNeutral = () => {
    setSelectedPreset(null);
    dispatch(setTonePreset({
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0
    }));
  };
  
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Define Your Communication Style
        </h2>
        <p className="text-gray-600">
          Adjust the sliders to match your preferred professional communication tone. 
          You can start with a preset or customize from scratch.
        </p>
      </div>
      
      {/* Preset Options */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Presets</h3>
        <div className="grid grid-cols-2 gap-3">
          {tonePresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset)}
              className={`
                text-left p-4 rounded-lg border-2 transition-all
                ${selectedPreset === preset.name
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              <h4 className="font-medium text-gray-900">{preset.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
            </button>
          ))}
        </div>
        
        <button
          onClick={resetToNeutral}
          className="mt-3 flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Reset to neutral
        </button>
      </div>
      
      {/* Tone Sliders */}
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Fine-tune Your Style</h3>
        
        <ToneSlider
          dimension="formal_casual"
          value={tonePreferences.formal_casual}
          onChange={(value) => handleSliderChange('formal_casual', value)}
        />
        
        <ToneSlider
          dimension="concise_detailed"
          value={tonePreferences.concise_detailed}
          onChange={(value) => handleSliderChange('concise_detailed', value)}
        />
        
        <ToneSlider
          dimension="analytical_creative"
          value={tonePreferences.analytical_creative}
          onChange={(value) => handleSliderChange('analytical_creative', value)}
        />
        
        <ToneSlider
          dimension="serious_playful"
          value={tonePreferences.serious_playful}
          onChange={(value) => handleSliderChange('serious_playful', value)}
        />
      </div>
      
      {/* Preview Section */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Your Tone Profile</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Formality:</span>
            <span className="ml-2 font-medium">
              {tonePreferences.formal_casual < -20 ? 'Very Formal' :
               tonePreferences.formal_casual < 0 ? 'Somewhat Formal' :
               tonePreferences.formal_casual === 0 ? 'Balanced' :
               tonePreferences.formal_casual < 20 ? 'Somewhat Casual' : 'Very Casual'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Detail Level:</span>
            <span className="ml-2 font-medium">
              {tonePreferences.concise_detailed < -20 ? 'Very Concise' :
               tonePreferences.concise_detailed < 0 ? 'Somewhat Concise' :
               tonePreferences.concise_detailed === 0 ? 'Balanced' :
               tonePreferences.concise_detailed < 20 ? 'Somewhat Detailed' : 'Very Detailed'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Thinking Style:</span>
            <span className="ml-2 font-medium">
              {tonePreferences.analytical_creative < -20 ? 'Very Analytical' :
               tonePreferences.analytical_creative < 0 ? 'Somewhat Analytical' :
               tonePreferences.analytical_creative === 0 ? 'Balanced' :
               tonePreferences.analytical_creative < 20 ? 'Somewhat Creative' : 'Very Creative'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Energy:</span>
            <span className="ml-2 font-medium">
              {tonePreferences.serious_playful < -20 ? 'Very Serious' :
               tonePreferences.serious_playful < 0 ? 'Somewhat Serious' :
               tonePreferences.serious_playful === 0 ? 'Balanced' :
               tonePreferences.serious_playful < 20 ? 'Somewhat Playful' : 'Very Playful'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TonePreferences;