import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Info, RefreshCw } from 'lucide-react';
import { 
  selectWorkshopState,
  updateTonePreference,
  setTonePreset,
  TonePreferences as TonePreferencesType
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';
import { useAnnounce, useFieldAccessibility } from '../../../hooks/useAccessibility';
import { focusVisible, KeyCodes } from '../../../utils/accessibility';
import LiveRegion from '../../accessibility/LiveRegion';

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

// Accessible Slider component for individual dimension
const ToneSlider: React.FC<{
  dimension: keyof TonePreferencesType;
  value: number;
  onChange: (value: number) => void;
}> = ({ dimension, value, onChange }) => {
  const info = dimensionInfo[dimension];
  const [showTooltip, setShowTooltip] = useState(false);
  const announce = useAnnounce();
  const sliderId = `tone-slider-${dimension}`;
  const tooltipId = `tooltip-${dimension}`;
  
  // Calculate position for the value indicator
  const position = ((value + 50) / 100) * 100;
  
  // Generate descriptive label for current value
  const getValueDescription = (val: number) => {
    const absVal = Math.abs(val);
    let intensity = '';
    if (absVal <= 10) intensity = 'Neutral';
    else if (absVal <= 25) intensity = 'Slightly';
    else if (absVal <= 40) intensity = 'Moderately';
    else intensity = 'Strongly';
    
    if (val === 0) return 'Neutral';
    const direction = val < 0 ? info.left.label : info.right.label;
    return `${intensity} ${direction}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    onChange(newValue);
    announce(`${info.left.label} to ${info.right.label} slider adjusted to ${getValueDescription(newValue)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let newValue = value;
    
    switch (e.key) {
      case KeyCodes.HOME:
        e.preventDefault();
        newValue = -50;
        break;
      case KeyCodes.END:
        e.preventDefault();
        newValue = 50;
        break;
      case KeyCodes.PAGE_UP:
        e.preventDefault();
        newValue = Math.min(value + 10, 50);
        break;
      case KeyCodes.PAGE_DOWN:
        e.preventDefault();
        newValue = Math.max(value - 10, -50);
        break;
    }
    
    if (newValue !== value) {
      onChange(newValue);
      announce(`${info.left.label} to ${info.right.label} slider adjusted to ${getValueDescription(newValue)}`);
    }
  };
  
  return (
    <div className="mb-8" role="group" aria-labelledby={`${sliderId}-label`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <h3 id={`${sliderId}-label`} className="text-lg font-medium text-gray-900">
            {info.left.label} ← → {info.right.label}
          </h3>
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="ml-2 text-gray-400 hover:text-gray-600 relative"
            aria-label={`Information about ${info.left.label} to ${info.right.label} scale`}
            aria-describedby={showTooltip ? tooltipId : undefined}
          >
            <Info className="w-4 h-4" />
            {showTooltip && (
              <div 
                id={tooltipId}
                role="tooltip"
                className="absolute left-0 top-6 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10"
              >
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
        <span className="text-sm font-medium text-blue-600" aria-live="polite">
          {getValueDescription(value)}
        </span>
      </div>
      
      <div className="relative">
        {/* Visual slider track */}
        <div className="h-2 bg-gray-200 rounded-full relative" aria-hidden="true">
          <div 
            className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ 
              left: value < 0 ? `${position}%` : '50%',
              right: value > 0 ? `${100 - position}%` : '50%'
            }}
          />
          <div 
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md transition-all duration-300"
            style={{ 
              left: `calc(${position}% - 8px)`,
              top: '-4px'
            }}
          />
        </div>
        
        {/* Accessible range input */}
        <input
          id={sliderId}
          type="range"
          min="-50"
          max="50"
          value={value}
          onChange={handleSliderChange}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`${info.left.label} to ${info.right.label} scale`}
          aria-valuemin={-50}
          aria-valuemax={50}
          aria-valuenow={value}
          aria-valuetext={getValueDescription(value)}
        />
        
        {/* Scale markers for visual reference */}
        <div className="flex justify-between mt-2 text-xs text-gray-500" aria-hidden="true">
          <span>{info.left.label}</span>
          <span>Neutral</span>
          <span>{info.right.label}</span>
        </div>
      </div>
    </div>
  );
};

const TonePreferences: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const announce = useAnnounce();
  const workshopState = useSelector(selectWorkshopState);
  const tonePreferences = workshopState?.tone || {
    formal_casual: 0,
    concise_detailed: 0,
    analytical_creative: 0,
    serious_playful: 0
  };
  
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSliderChange = (dimension: keyof TonePreferencesType, value: number) => {
    dispatch(updateTonePreference({ dimension, value }));
    // Clear preset selection when manually adjusting
    setSelectedPreset(null);
  };

  const handlePresetSelect = (preset: typeof tonePresets[0]) => {
    dispatch(setTonePreset(preset.values));
    setSelectedPreset(preset.name);
    announce(`Applied ${preset.name} tone preset: ${preset.description}`);
    setStatusMessage(`Applied ${preset.name} preset`);
    
    // Clear status message after 3 seconds
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleReset = () => {
    const neutralValues = {
      formal_casual: 0,
      concise_detailed: 0,
      analytical_creative: 0,
      serious_playful: 0
    };
    dispatch(setTonePreset(neutralValues));
    setSelectedPreset(null);
    announce('Reset all tone preferences to neutral');
    setStatusMessage('Reset to neutral');
    
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Define Your Communication Style</h2>
        <p className="text-lg text-gray-600">
          Adjust the sliders to match your preferred tone of voice. This helps us generate content 
          that sounds authentically like you.
        </p>
      </div>

      {/* Status message for screen readers and visual users */}
      <LiveRegion>
        {statusMessage && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg" role="status">
            {statusMessage}
          </div>
        )}
      </LiveRegion>

      {/* Preset Profiles */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Start Presets</h3>
          <button
            onClick={handleReset}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${focusVisible} ${
              Object.values(tonePreferences).every(v => v === 0)
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
            disabled={Object.values(tonePreferences).every(v => v === 0)}
            aria-label="Reset all tone preferences to neutral"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Neutral
          </button>
        </div>
        
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          role="group"
          aria-label="Tone preset options"
        >
          {tonePresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${focusVisible} ${
                selectedPreset === preset.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              aria-pressed={selectedPreset === preset.name}
              aria-describedby={`preset-${preset.name.replace(/\s+/g, '-')}-desc`}
            >
              <h4 className="font-semibold text-gray-900 mb-1">{preset.name}</h4>
              <p id={`preset-${preset.name.replace(/\s+/g, '-')}-desc`} className="text-sm text-gray-600">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Tone Sliders */}
      <div className="space-y-6">
        {(Object.keys(dimensionInfo) as Array<keyof TonePreferencesType>).map((dimension) => (
          <ToneSlider
            key={dimension}
            dimension={dimension}
            value={tonePreferences[dimension]}
            onChange={(value) => handleSliderChange(dimension, value)}
          />
        ))}
      </div>

      {/* Instructions for keyboard users */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-semibold mb-2">Keyboard Navigation:</p>
        <ul className="space-y-1">
          <li>• Use <kbd>←</kbd> <kbd>→</kbd> arrow keys to adjust by 1</li>
          <li>• Use <kbd>Page Up</kbd> <kbd>Page Down</kbd> to adjust by 10</li>
          <li>• Use <kbd>Home</kbd> <kbd>End</kbd> to jump to extremes</li>
          <li>• Press <kbd>Tab</kbd> to move between sliders</li>
        </ul>
      </div>
    </div>
  );
};

export default TonePreferences;