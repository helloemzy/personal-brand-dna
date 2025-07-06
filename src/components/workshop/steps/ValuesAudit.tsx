import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Info, Star } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { 
  selectValue,
  deselectValue,
  addCustomValue,
  rankValue,
  selectWorkshopState,
  WorkshopValue
} from '../../../store/slices/workshopSlice';

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
  
  // Use the proper selector that handles persisted state
  const workshopState = useAppSelector(selectWorkshopState);
  
  // Debug log the workshop state
  console.log('ValuesAudit - workshopState:', workshopState);
  console.log('ValuesAudit - workshopState.values:', workshopState?.values);
  
  // Safe access with proper defaults
  const selectedValues = workshopState?.values?.selected || [];
  const customValues = workshopState?.values?.custom || [];
  const rankings = workshopState?.values?.rankings || {};
  
  // Additional debug logging
  console.log('ValuesAudit - selectedValues:', selectedValues);
  console.log('ValuesAudit - type of selectedValues:', typeof selectedValues, Array.isArray(selectedValues));
  
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customValueName, setCustomValueName] = useState('');

  const handleValueToggle = useCallback((valueId: string) => {
    try {
      if (!valueId) {
        console.error('handleValueToggle: valueId is undefined');
        return;
      }
      
      // Log state before action for debugging
      console.log('Before toggle - selectedValues:', selectedValues);
      console.log('Toggling value:', valueId);
      
      // Ensure arrays are valid before checking
      const values = Array.isArray(selectedValues) ? selectedValues : [];
      
      if (values.includes(valueId)) {
        console.log('Deselecting value:', valueId);
        dispatch(deselectValue(valueId));
      } else if (values.length < 10) {
        console.log('Selecting value:', valueId);
        dispatch(selectValue(valueId));
      } else {
        console.log('Cannot select more than 10 values');
      }
    } catch (error) {
      console.error('Error in handleValueToggle:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      // Don't re-throw - let the UI continue functioning
    }
  }, [selectedValues, dispatch]);

  const handleAddCustomValue = useCallback(() => {
    const values = Array.isArray(selectedValues) ? selectedValues : [];
    if (customValueName.trim() && values.length < 10) {
      const customValue: WorkshopValue = {
        id: `custom_${Date.now()}`,
        name: customValueName.trim(),
        category: 'Custom',
        description: 'Your personal value',
        isCustom: true
      };
      dispatch(addCustomValue(customValue));
      setCustomValueName('');
      setShowCustomForm(false);
    }
  }, [customValueName, selectedValues, dispatch]);

  const handleRankValue = useCallback((valueId: string, rank: number) => {
    try {
      if (!valueId || isNaN(rank) || rank < 1 || rank > 5) {
        console.error('Invalid rank value:', { valueId, rank });
        return;
      }
      dispatch(rankValue({ valueId, rank }));
    } catch (error) {
      console.error('Error ranking value:', error);
    }
  }, [dispatch]);

  const getAllValues = useMemo(() => {
    const allValues: WorkshopValue[] = [];
    Object.entries(VALUE_CATEGORIES).forEach(([category, values]) => {
      values.forEach(value => {
        allValues.push({ ...value, category });
      });
    });
    return [...allValues, ...customValues];
  }, [customValues]);

  const getValueById = useCallback((id: string) => {
    return getAllValues.find(v => v.id === id);
  }, [getAllValues]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          What are your core professional values?
        </h2>
        <p className="mt-2 text-gray-600">
          Select 5-10 values that truly resonate with your professional identity. 
          These will help shape your authentic brand voice.
        </p>
      </div>

      {/* Selection Counter */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Info className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-blue-900">
              {Array.isArray(selectedValues) ? selectedValues.length : 0}/10 values selected
              {(!Array.isArray(selectedValues) || selectedValues.length < 5) && ' (minimum 5 required)'}
            </span>
          </div>
          <button
            onClick={() => setShowCustomForm(true)}
            disabled={Array.isArray(selectedValues) && selectedValues.length >= 10}
            className="flex items-center text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Custom Value
          </button>
        </div>
      </div>

      {/* Value Categories */}
      <div className="space-y-6">
        {Object.entries(VALUE_CATEGORIES).map(([category, values]) => (
          <div key={category} className="space-y-3">
            <h3 className="font-semibold text-gray-900">{category}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {values.map((value) => {
                const values = Array.isArray(selectedValues) ? selectedValues : [];
                const isSelected = values.includes(value.id);
                const rank = rankings?.[value.id];
                
                return (
                  <div
                    key={value.id}
                    onClick={() => {
                      const vals = Array.isArray(selectedValues) ? selectedValues : [];
                      if (vals.length < 10 || isSelected) {
                        handleValueToggle(value.id);
                      }
                    }}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                      ${(Array.isArray(selectedValues) && selectedValues.length >= 10 && !isSelected) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{value.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{value.description}</p>
                      </div>
                      {isSelected && (
                        <div className="ml-2">
                          <select
                            value={rank || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleRankValue(value.id, parseInt(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5"
                          >
                            <option value="">Rank</option>
                            {[1, 2, 3, 4, 5].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom Values */}
        {customValues.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Your Custom Values</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {customValues.map((value) => {
                const vals = Array.isArray(selectedValues) ? selectedValues : [];
                const isSelected = vals.includes(value.id);
                const rank = rankings?.[value.id];
                return (
                  <div
                    key={value.id}
                    onClick={() => {
                      const vals = Array.isArray(selectedValues) ? selectedValues : [];
                      if (vals.length < 10 || isSelected) {
                        handleValueToggle(value.id);
                      }
                    }}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                      ${(Array.isArray(selectedValues) && selectedValues.length >= 10 && !isSelected) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{value.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{value.description}</p>
                      </div>
                      {isSelected && (
                        <div className="ml-2">
                          <select
                            value={rank || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleRankValue(value.id, parseInt(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5"
                          >
                            <option value="">Rank</option>
                            {[1, 2, 3, 4, 5].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Values Summary */}
      {Array.isArray(selectedValues) && selectedValues.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Your Selected Values</h3>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(selectedValues) ? selectedValues : [])
              .sort((a, b) => {
                const rankA = rankings?.[a] || 999;
                const rankB = rankings?.[b] || 999;
                return rankA - rankB;
              })
              .map((valueId) => {
                const value = getValueById(valueId);
                const rank = rankings?.[valueId];
                return value ? (
                  <div
                    key={valueId}
                    className="flex items-center bg-white px-3 py-1.5 rounded-full border border-gray-200"
                  >
                    {rank && (
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {rank && `${rank}. `}{value.name}
                    </span>
                  </div>
                ) : null;
              })}
          </div>
        </div>
      )}

      {/* Custom Value Form Modal */}
      {showCustomForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Your Own Value</h3>
            <input
              type="text"
              value={customValueName}
              onChange={(e) => setCustomValueName(e.target.value)}
              placeholder="Enter your custom value"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={30}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomValueName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomValue}
                disabled={!customValueName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ValuesAudit);