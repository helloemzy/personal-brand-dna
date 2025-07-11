import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Info, Star, ArrowRight } from 'lucide-react';
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
import { logger } from '../../../utils/logger';

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
  logger.debug('ValuesAudit - workshopState:', workshopState);
  logger.debug('ValuesAudit - workshopState.values:', workshopState?.values);
  
  // Safe access with proper defaults
  const selectedValues = workshopState?.values?.selected || [];
  const customValues = workshopState?.values?.custom || [];
  const rankings = workshopState?.values?.rankings || {};
  const primaryValues = workshopState?.values?.primary || [];
  const aspirationalValues = workshopState?.values?.aspirational || [];
  const valueStories = workshopState?.values?.stories || {};
  
  // Additional debug logging
  logger.debug('ValuesAudit - selectedValues:', selectedValues);
  logger.debug('ValuesAudit - type of selectedValues:', typeof selectedValues, Array.isArray(selectedValues));
  
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customValueName, setCustomValueName] = useState('');
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [storyValueId, setStoryValueId] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');

  const handleValueToggle = useCallback((valueId: string) => {
    try {
      if (!valueId) {
        logger.error('handleValueToggle: valueId is undefined');
        return;
      }
      
      // Log state before action for debugging
      logger.debug('Before toggle - selectedValues:', selectedValues);
      logger.debug('Toggling value:', valueId);
      
      // Ensure arrays are valid before checking
      const values = Array.isArray(selectedValues) ? selectedValues : [];
      
      if (values.includes(valueId)) {
        logger.debug('Deselecting value:', valueId);
        dispatch(deselectValue(valueId));
      } else if (values.length < 10) {
        logger.debug('Selecting value:', valueId);
        dispatch(selectValue(valueId));
      } else {
        logger.debug('Cannot select more than 10 values');
      }
    } catch (error) {
      logger.error('Error in handleValueToggle:', error);
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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
        logger.error('Invalid rank value:', { valueId, rank });
        return;
      }
      dispatch(rankValue({ valueId, rank }));
    } catch (error) {
      logger.error('Error ranking value:', error);
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

  const handlePrimaryValueToggle = useCallback((valueId: string) => {
    const currentPrimary = [...primaryValues];
    const index = currentPrimary.indexOf(valueId);
    
    if (index > -1) {
      currentPrimary.splice(index, 1);
    } else if (currentPrimary.length < 2) {
      currentPrimary.push(valueId);
    }
    
    dispatch(setPrimaryValues(currentPrimary));
  }, [primaryValues, dispatch]);

  const handleAspirationalValueToggle = useCallback((valueId: string) => {
    const currentAspirational = [...aspirationalValues];
    const index = currentAspirational.indexOf(valueId);
    
    if (index > -1) {
      currentAspirational.splice(index, 1);
    } else if (currentAspirational.length < 3) {
      currentAspirational.push(valueId);
    }
    
    dispatch(setAspirationalValues(currentAspirational));
  }, [aspirationalValues, dispatch]);

  const handleSaveStory = useCallback(() => {
    if (storyValueId && storyText.trim()) {
      dispatch(addValueStory({ valueId: storyValueId, story: storyText.trim() }));
      setStoryValueId(null);
      setStoryText('');
    }
  }, [storyValueId, storyText, dispatch]);

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
            {[...(Array.isArray(selectedValues) ? selectedValues : [])]
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

      {/* Value Hierarchy Section */}
      {Array.isArray(selectedValues) && selectedValues.length >= 5 && (
        <div className="mt-8 space-y-6">
          <button
            onClick={() => setShowHierarchy(!showHierarchy)}
            className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <Star className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-semibold text-blue-900">
                Define Your Value Hierarchy
              </span>
            </div>
            <ArrowRight className={`w-5 h-5 text-blue-600 transform transition-transform ${showHierarchy ? 'rotate-90' : ''}`} />
          </button>

          {showHierarchy && (
            <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
              {/* Primary Values */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Which 2 values are absolutely non-negotiable for you?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  These are your core values that you will never compromise on.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedValues.map((valueId) => {
                    const value = getValueById(valueId);
                    const isPrimary = primaryValues.includes(valueId);
                    return value ? (
                      <div
                        key={valueId}
                        onClick={() => handlePrimaryValueToggle(valueId)}
                        className={`
                          p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${isPrimary
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                          }
                          ${primaryValues.length >= 2 && !isPrimary
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                          }
                        `}
                      >
                        <div className="flex items-center">
                          {isPrimary && <Star className="w-4 h-4 text-yellow-500 mr-2" />}
                          <span className="text-sm font-medium">{value.name}</span>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
                {primaryValues.length < 2 && (
                  <p className="text-xs text-orange-600 mt-2">
                    Please select 2 non-negotiable values
                  </p>
                )}
              </div>

              {/* Aspirational Values */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Which values do you aspire to embody more?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select up to 3 values you want to develop further.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedValues.map((valueId) => {
                    const value = getValueById(valueId);
                    const isAspirational = aspirationalValues.includes(valueId);
                    const isPrimary = primaryValues.includes(valueId);
                    return value && !isPrimary ? (
                      <div
                        key={valueId}
                        onClick={() => handleAspirationalValueToggle(valueId)}
                        className={`
                          p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${isAspirational
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                          }
                          ${aspirationalValues.length >= 3 && !isAspirational
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                          }
                        `}
                      >
                        <span className="text-sm font-medium">{value.name}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Value Stories */}
              {primaryValues.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Share a brief story about living your values
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Tell us about a time when you demonstrated one of your primary values.
                  </p>
                  <div className="space-y-3">
                    {primaryValues.map((valueId) => {
                      const value = getValueById(valueId);
                      const hasStory = valueStories[valueId];
                      return value ? (
                        <div key={valueId} className="bg-white p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{value.name}</h4>
                            {hasStory ? (
                              <span className="text-xs text-green-600">Story saved</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setStoryValueId(valueId);
                                  setStoryText(valueStories[valueId] || '');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                Add story
                              </button>
                            )}
                          </div>
                          {storyValueId === valueId ? (
                            <div className="space-y-2">
                              <textarea
                                value={storyText}
                                onChange={(e) => setStoryText(e.target.value)}
                                placeholder="Describe a specific moment when this value guided your actions..."
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={3}
                              />
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setStoryValueId(null);
                                    setStoryText('');
                                  }}
                                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveStory}
                                  disabled={!storyText.trim()}
                                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Save Story
                                </button>
                              </div>
                            </div>
                          ) : (
                            hasStory && (
                              <p className="text-sm text-gray-600">{valueStories[valueId]}</p>
                            )
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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