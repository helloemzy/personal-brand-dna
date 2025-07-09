import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Info, Star, ArrowRight, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { 
  selectValue,
  deselectValue,
  addCustomValue,
  rankValue,
  setPrimaryValues,
  setAspirationalValues,
  addValueStory,
  selectWorkshopState,
  WorkshopValue
} from '../../../store/slices/workshopSlice';
import { useAnnounce, useFieldAccessibility } from '../../../hooks/useAccessibility';
import { focusVisible, KeyCodes } from '../../../utils/accessibility';
import { TextInput, TextArea, Checkbox } from '../../accessibility/FormField';
import LiveRegion from '../../accessibility/LiveRegion';

// Professional values organized by category
const VALUE_CATEGORIES = {
  'Leadership & Impact': [
    { id: 'leadership', name: 'Leadership', description: 'Guiding and inspiring others' },
    { id: 'innovation', name: 'Innovation', description: 'Creating new solutions and approaches' },
    { id: 'influence', name: 'Influence', description: 'Making a meaningful impact' },
    { id: 'mentorship', name: 'Mentorship', description: 'Developing others\' potential' },
    { id: 'vision', name: 'Vision', description: 'Seeing and creating the future' }
  ],
  'Integrity & Ethics': [
    { id: 'integrity', name: 'Integrity', description: 'Acting with honesty and principle' },
    { id: 'transparency', name: 'Transparency', description: 'Open and clear communication' },
    { id: 'accountability', name: 'Accountability', description: 'Taking responsibility for outcomes' },
    { id: 'authenticity', name: 'Authenticity', description: 'Being genuine and true to yourself' },
    { id: 'fairness', name: 'Fairness', description: 'Treating everyone equitably' }
  ],
  'Growth & Learning': [
    { id: 'growth', name: 'Growth', description: 'Continuous personal development' },
    { id: 'curiosity', name: 'Curiosity', description: 'Eager to learn and explore' },
    { id: 'adaptability', name: 'Adaptability', description: 'Flexibility in changing situations' },
    { id: 'resilience', name: 'Resilience', description: 'Bouncing back from challenges' },
    { id: 'mastery', name: 'Mastery', description: 'Pursuit of excellence in skills' }
  ],
  'Collaboration & Relationships': [
    { id: 'collaboration', name: 'Collaboration', description: 'Working effectively with others' },
    { id: 'empathy', name: 'Empathy', description: 'Understanding others\' perspectives' },
    { id: 'communication', name: 'Communication', description: 'Clear and effective exchange of ideas' },
    { id: 'teamwork', name: 'Teamwork', description: 'Contributing to collective success' },
    { id: 'respect', name: 'Respect', description: 'Valuing others and their contributions' }
  ],
  'Achievement & Excellence': [
    { id: 'excellence', name: 'Excellence', description: 'Commitment to quality' },
    { id: 'results', name: 'Results', description: 'Focus on achieving outcomes' },
    { id: 'efficiency', name: 'Efficiency', description: 'Maximizing productivity' },
    { id: 'precision', name: 'Precision', description: 'Attention to detail and accuracy' },
    { id: 'ambition', name: 'Ambition', description: 'Drive to achieve goals' }
  ],
  'Creativity & Innovation': [
    { id: 'creativity', name: 'Creativity', description: 'Generating original ideas' },
    { id: 'experimentation', name: 'Experimentation', description: 'Trying new approaches' },
    { id: 'problemSolving', name: 'Problem Solving', description: 'Finding solutions to challenges' },
    { id: 'imagination', name: 'Imagination', description: 'Envisioning possibilities' },
    { id: 'resourcefulness', name: 'Resourcefulness', description: 'Making the most of what\'s available' }
  ]
};

const ValuesAudit: React.FC = () => {
  const dispatch = useAppDispatch();
  const announce = useAnnounce();
  
  // Use the proper selector that handles persisted state
  const workshopState = useAppSelector(selectWorkshopState);
  
  // Safe access with proper defaults
  const selectedValues = workshopState?.values?.selected || [];
  const customValues = workshopState?.values?.custom || [];
  const rankings = workshopState?.values?.rankings || {};
  const primaryValues = workshopState?.values?.primary || [];
  const aspirationalValues = workshopState?.values?.aspirational || [];
  const valueStories = workshopState?.values?.stories || {};
  
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customValueName, setCustomValueName] = useState('');
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [storyValueId, setStoryValueId] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const customFormRef = useRef<HTMLDivElement>(null);

  const handleValueToggle = useCallback((valueId: string) => {
    try {
      if (!valueId) return;
      
      const currentlySelected = Array.isArray(selectedValues) && selectedValues.includes(valueId);
      
      if (currentlySelected) {
        dispatch(deselectValue(valueId));
        announce(`${valueId} value deselected`);
      } else {
        if (selectedValues.length >= 10) {
          setStatusMessage('Maximum 10 values can be selected');
          announce('Maximum 10 values reached', 'assertive');
          return;
        }
        dispatch(selectValue(valueId));
        announce(`${valueId} value selected`);
      }
      
      setStatusMessage(`${selectedValues.length + (currentlySelected ? -1 : 1)} of 10 values selected`);
    } catch (error) {
      console.error('Error toggling value:', error);
      setStatusMessage('Error updating selection');
    }
  }, [selectedValues, dispatch, announce]);

  const handleCustomValueSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (customValueName.trim() && selectedValues.length < 10) {
      dispatch(addCustomValue(customValueName.trim()));
      setCustomValueName('');
      setShowCustomForm(false);
      announce(`Custom value "${customValueName}" added`);
      setStatusMessage(`Custom value added. ${selectedValues.length + 1} of 10 values selected`);
    }
  }, [customValueName, selectedValues.length, dispatch, announce]);

  const handleRankingChange = useCallback((valueId: string, rank: number) => {
    dispatch(rankValue({ valueId, rank }));
    announce(`${valueId} ranked as number ${rank}`);
  }, [dispatch, announce]);

  const handlePrimaryValueToggle = useCallback((valueId: string) => {
    const newPrimary = primaryValues.includes(valueId)
      ? primaryValues.filter(id => id !== valueId)
      : [...primaryValues, valueId];
    
    if (newPrimary.length <= 2) {
      dispatch(setPrimaryValues(newPrimary));
      announce(`${valueId} ${newPrimary.includes(valueId) ? 'marked as' : 'removed from'} primary value`);
    } else {
      setStatusMessage('Maximum 2 primary values allowed');
      announce('Maximum 2 primary values allowed', 'assertive');
    }
  }, [primaryValues, dispatch, announce]);

  const handleAspirationalValueToggle = useCallback((valueId: string) => {
    const newAspirational = aspirationalValues.includes(valueId)
      ? aspirationalValues.filter(id => id !== valueId)
      : [...aspirationalValues, valueId];
    
    dispatch(setAspirationalValues(newAspirational));
    announce(`${valueId} ${newAspirational.includes(valueId) ? 'marked as' : 'removed from'} aspirational value`);
  }, [aspirationalValues, dispatch, announce]);

  const handleStorySubmit = useCallback(() => {
    if (storyValueId && storyText.trim()) {
      dispatch(addValueStory({ valueId: storyValueId, story: storyText.trim() }));
      setStoryValueId(null);
      setStoryText('');
      announce('Value story saved');
    }
  }, [storyValueId, storyText, dispatch, announce]);

  // Get all selected values including custom ones
  const allSelectedValues = useMemo(() => {
    const allValues: WorkshopValue[] = [];
    
    // Add predefined values
    Object.entries(VALUE_CATEGORIES).forEach(([category, values]) => {
      values.forEach(value => {
        if (selectedValues.includes(value.id)) {
          allValues.push(value);
        }
      });
    });
    
    // Add custom values
    customValues.forEach(value => {
      allValues.push(value);
    });
    
    return allValues;
  }, [selectedValues, customValues]);

  // Sort values by ranking
  const sortedValues = useMemo(() => {
    return [...allSelectedValues].sort((a, b) => {
      const rankA = rankings[a.id] || 999;
      const rankB = rankings[b.id] || 999;
      return rankA - rankB;
    });
  }, [allSelectedValues, rankings]);

  return (
    <div className="space-y-6">
      <LiveRegion message={statusMessage} priority="polite" />
      
      {/* Step Introduction */}
      <section aria-labelledby="values-intro-heading">
        <h2 id="values-intro-heading" className="text-2xl font-bold text-gray-900 mb-3">
          What drives your professional journey?
        </h2>
        <p className="text-gray-600 mb-6">
          Select 5-10 values that represent what's most important to you in your work. 
          These will form the foundation of your personal brand.
        </p>
      </section>

      {/* Progress Indicator */}
      <div className="bg-gray-100 rounded-lg p-4" role="status" aria-live="polite">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Selected Values: {selectedValues.length + customValues.length} of 10
          </span>
          {selectedValues.length + customValues.length >= 5 && (
            <span className="text-sm text-green-600 flex items-center">
              <Check className="w-4 h-4 mr-1" aria-hidden="true" />
              <span>Minimum reached</span>
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={(selectedValues.length + customValues.length) * 10} aria-valuemin={0} aria-valuemax={100}>
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((selectedValues.length + customValues.length) * 10, 100)}%` }}
          />
        </div>
      </div>

      {/* Values Selection */}
      <section aria-labelledby="values-selection-heading">
        <h3 id="values-selection-heading" className="sr-only">Select Your Values</h3>
        {Object.entries(VALUE_CATEGORIES).map(([category, values]) => (
          <fieldset key={category} className="mb-6">
            <legend className="text-lg font-semibold text-gray-800 mb-3">{category}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group">
              {values.map((value) => {
                const isSelected = selectedValues.includes(value.id);
                return (
                  <label
                    key={value.id}
                    className={`
                      relative flex items-start p-4 rounded-lg border-2 cursor-pointer
                      transition-all duration-200 ${focusVisible}
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => handleValueToggle(value.id)}
                      aria-describedby={`${value.id}-desc`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className={`
                          w-5 h-5 rounded flex items-center justify-center mr-3
                          ${isSelected ? 'bg-blue-600' : 'bg-white border-2 border-gray-300'}
                        `} aria-hidden="true">
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {value.name}
                        </span>
                      </div>
                      <p id={`${value.id}-desc`} className="mt-1 text-sm text-gray-600 ml-8">
                        {value.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </section>

      {/* Custom Value Section */}
      <section aria-labelledby="custom-value-heading" className="border-t pt-6">
        <h3 id="custom-value-heading" className="text-lg font-semibold text-gray-800 mb-3">
          Don't see your value?
        </h3>
        
        {!showCustomForm ? (
          <button
            onClick={() => {
              setShowCustomForm(true);
              setTimeout(() => customFormRef.current?.focus(), 100);
            }}
            disabled={selectedValues.length + customValues.length >= 10}
            className={`
              inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg
              text-sm font-medium text-gray-700 bg-white hover:bg-gray-50
              disabled:opacity-50 disabled:cursor-not-allowed ${focusVisible}
            `}
            aria-label="Add custom value"
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add Custom Value
          </button>
        ) : (
          <form onSubmit={handleCustomValueSubmit} className="space-y-3">
            <TextInput
              ref={customFormRef}
              label="Custom Value Name"
              value={customValueName}
              onChange={(e) => setCustomValueName(e.target.value)}
              placeholder="e.g., Work-Life Balance"
              required
              maxLength={30}
            />
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!customValueName.trim() || selectedValues.length + customValues.length >= 10}
                className={`
                  px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                  hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${focusVisible}
                `}
              >
                Add Value
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomValueName('');
                }}
                className={`
                  px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium
                  hover:bg-gray-50 ${focusVisible}
                `}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        
        {/* Display custom values */}
        {customValues.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Your Custom Values:</h4>
            <div className="flex flex-wrap gap-2" role="list">
              {customValues.map((value) => (
                <div
                  key={value.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                  role="listitem"
                >
                  <span>{value.name}</span>
                  <button
                    onClick={() => {
                      dispatch(deselectValue(value.id));
                      announce(`Custom value ${value.name} removed`);
                    }}
                    className={`ml-2 text-purple-600 hover:text-purple-800 ${focusVisible}`}
                    aria-label={`Remove ${value.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Value Hierarchy Section */}
      {allSelectedValues.length >= 5 && (
        <section aria-labelledby="hierarchy-heading" className="border-t pt-6">
          <h3 id="hierarchy-heading" className="text-lg font-semibold text-gray-800 mb-3">
            Create Your Value Hierarchy
          </h3>
          
          {!showHierarchy ? (
            <button
              onClick={() => setShowHierarchy(true)}
              className={`
                inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg
                font-medium hover:bg-blue-700 ${focusVisible}
              `}
            >
              <Star className="w-4 h-4 mr-2" aria-hidden="true" />
              Prioritize Values
            </button>
          ) : (
            <div className="space-y-6">
              {/* Ranking Section */}
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">
                  Drag to rank your values (1 = most important)
                </h4>
                <div className="space-y-2" role="list" aria-label="Ranked values">
                  {sortedValues.map((value, index) => (
                    <div
                      key={value.id}
                      className="flex items-center p-3 bg-white border border-gray-200 rounded-lg"
                      role="listitem"
                    >
                      <input
                        type="number"
                        min="1"
                        max={allSelectedValues.length}
                        value={rankings[value.id] || index + 1}
                        onChange={(e) => handleRankingChange(value.id, parseInt(e.target.value))}
                        className={`w-12 mr-3 text-center rounded border-gray-300 ${focusVisible}`}
                        aria-label={`Rank for ${value.name}`}
                      />
                      <span className="flex-1 font-medium">{value.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Values */}
              <fieldset>
                <legend className="text-md font-medium text-gray-700 mb-3">
                  Select 2 primary (non-negotiable) values:
                </legend>
                <div className="space-y-2" role="group">
                  {sortedValues.slice(0, 5).map((value) => (
                    <Checkbox
                      key={value.id}
                      label={value.name}
                      checked={primaryValues.includes(value.id)}
                      onChange={() => handlePrimaryValueToggle(value.id)}
                      description={primaryValues.includes(value.id) ? 'Primary value' : undefined}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Aspirational Values */}
              <fieldset>
                <legend className="text-md font-medium text-gray-700 mb-3">
                  Select any aspirational values (want to develop):
                </legend>
                <div className="space-y-2" role="group">
                  {sortedValues.map((value) => (
                    <Checkbox
                      key={value.id}
                      label={value.name}
                      checked={aspirationalValues.includes(value.id)}
                      onChange={() => handleAspirationalValueToggle(value.id)}
                      description={aspirationalValues.includes(value.id) ? 'Aspirational value' : undefined}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Value Stories */}
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">
                  Share a story about one of your primary values:
                </h4>
                {primaryValues.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={storyValueId || ''}
                      onChange={(e) => setStoryValueId(e.target.value)}
                      className={`w-full rounded-lg border-gray-300 ${focusVisible}`}
                      aria-label="Select value for story"
                    >
                      <option value="">Select a value...</option>
                      {primaryValues.map((valueId) => {
                        const value = allSelectedValues.find(v => v.id === valueId);
                        return value ? (
                          <option key={value.id} value={value.id}>
                            {value.name}
                          </option>
                        ) : null;
                      })}
                    </select>
                    
                    {storyValueId && (
                      <div>
                        <TextArea
                          label="Your story"
                          value={storyText}
                          onChange={(e) => setStoryText(e.target.value)}
                          placeholder="Share a brief story about how this value shows up in your work..."
                          rows={4}
                        />
                        <button
                          onClick={handleStorySubmit}
                          disabled={!storyText.trim()}
                          className={`
                            mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${focusVisible}
                          `}
                        >
                          Save Story
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    Please select your primary values first.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Completion Summary */}
      {allSelectedValues.length >= 5 && primaryValues.length === 2 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4" role="status">
          <div className="flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-2" aria-hidden="true" />
            <div>
              <p className="font-medium text-green-800">Step complete!</p>
              <p className="text-sm text-green-700 mt-1">
                You've selected {allSelectedValues.length} values with {primaryValues.length} primary values.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValuesAudit;