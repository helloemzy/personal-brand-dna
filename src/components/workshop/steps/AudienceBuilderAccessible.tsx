import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit2, Trash2, Users, Target, Briefcase, MessageSquare, Star } from 'lucide-react';
import { 
  selectWorkshopState,
  addPersona,
  updatePersona,
  removePersona,
  setPrimaryPersona,
  AudiencePersona
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';
import { useAnnounce, useFieldAccessibility, useFocusTrap } from '../../../hooks/useAccessibility';
import { focusVisible, KeyCodes } from '../../../utils/accessibility';
import FormField from '../../accessibility/FormField';
import LiveRegion from '../../accessibility/LiveRegion';

// Template personas for quick start
const personaTemplates = [
  {
    name: 'Senior Executive',
    role: 'C-Suite / VP Level',
    industry: 'Technology',
    painPoints: ['Limited time', 'Need strategic insights', 'Managing large teams'],
    goals: ['Drive innovation', 'Scale operations', 'Improve ROI'],
    communicationStyle: 'formal' as const
  },
  {
    name: 'Mid-Level Manager',
    role: 'Team Lead / Manager',
    industry: 'Various',
    painPoints: ['Team productivity', 'Career advancement', 'Work-life balance'],
    goals: ['Build strong teams', 'Deliver results', 'Grow professionally'],
    communicationStyle: 'conversational' as const
  },
  {
    name: 'Individual Contributor',
    role: 'Specialist / Analyst',
    industry: 'Professional Services',
    painPoints: ['Skill development', 'Recognition', 'Technical challenges'],
    goals: ['Master expertise', 'Advance career', 'Make impact'],
    communicationStyle: 'technical' as const
  },
  {
    name: 'Entrepreneur',
    role: 'Founder / Business Owner',
    industry: 'Startup',
    painPoints: ['Resource constraints', 'Market validation', 'Scaling challenges'],
    goals: ['Build sustainable business', 'Find investors', 'Create impact'],
    communicationStyle: 'casual' as const
  }
];

// Accessible Persona form component
const PersonaForm: React.FC<{
  persona?: AudiencePersona;
  onSave: (persona: Omit<AudiencePersona, 'id'>) => void;
  onCancel: () => void;
}> = ({ persona, onSave, onCancel }) => {
  const announce = useAnnounce();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const { setFocusTrap, clearFocusTrap } = useFocusTrap();
  
  const [formData, setFormData] = useState({
    name: persona?.name || '',
    role: persona?.role || '',
    industry: persona?.industry || '',
    painPoints: persona?.painPoints || [''],
    goals: persona?.goals || [''],
    communicationStyle: persona?.communicationStyle || 'conversational' as const,
    demographicInfo: persona?.demographicInfo || {
      ageRange: '',
      experience: '',
      company_size: ''
    },
    transformation: persona?.transformation || {
      outcome: '',
      beforeState: '',
      afterState: ''
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (formRef.current) {
      setFocusTrap(formRef.current);
      firstFieldRef.current?.focus();
    }
    
    return () => clearFocusTrap();
  }, [setFocusTrap, clearFocusTrap]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Persona name is required';
    }
    if (!formData.role.trim()) {
      newErrors.role = 'Role is required';
    }
    if (!formData.transformation.outcome.trim()) {
      newErrors.transformation = 'Transformation outcome is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      announce('Please fix the errors in the form');
      return;
    }
    
    onSave({
      ...formData,
      painPoints: formData.painPoints.filter(p => p.trim()),
      goals: formData.goals.filter(g => g.trim())
    });
    
    announce(`${persona ? 'Updated' : 'Created'} persona: ${formData.name}`);
  };

  const addListItem = (field: 'painPoints' | 'goals') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
    announce(`Added new ${field === 'painPoints' ? 'pain point' : 'goal'} field`);
  };

  const updateListItem = (field: 'painPoints' | 'goals', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeListItem = (field: 'painPoints' | 'goals', index: number) => {
    if (formData[field].length > 1) {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }));
      announce(`Removed ${field === 'painPoints' ? 'pain point' : 'goal'}`);
    }
  };

  return (
    <form 
      ref={formRef}
      onSubmit={handleSubmit} 
      className="bg-white p-6 rounded-lg shadow-sm"
      aria-label={`${persona ? 'Edit' : 'Create new'} persona form`}
    >
      <h3 className="text-xl font-semibold mb-6">
        {persona ? 'Edit Persona' : 'Create New Persona'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <FormField
          label="Persona Name"
          error={errors.name}
          required
        >
          <input
            ref={firstFieldRef}
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg ${focusVisible} ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
        </FormField>

        <FormField
          label="Role / Title"
          error={errors.role}
          required
        >
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg ${focusVisible} ${
              errors.role ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </FormField>

        <FormField label="Industry">
          <input
            type="text"
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg ${focusVisible}`}
          />
        </FormField>

        <FormField label="Communication Style">
          <select
            value={formData.communicationStyle}
            onChange={(e) => setFormData({ ...formData, communicationStyle: e.target.value as any })}
            className={`w-full px-4 py-2 border rounded-lg ${focusVisible}`}
          >
            <option value="formal">Formal</option>
            <option value="conversational">Conversational</option>
            <option value="technical">Technical</option>
            <option value="casual">Casual</option>
          </select>
        </FormField>
      </div>

      {/* Transformation Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Transformation Journey
        </h4>
        
        <FormField
          label="What's the #1 transformation you help them achieve?"
          error={errors.transformation}
          required
        >
          <textarea
            value={formData.transformation.outcome}
            onChange={(e) => setFormData({
              ...formData,
              transformation: { ...formData.transformation, outcome: e.target.value }
            })}
            rows={2}
            className={`w-full px-4 py-2 border rounded-lg ${focusVisible} ${
              errors.transformation ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., From overwhelmed to organized, from unknown to recognized expert"
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Before State (How they feel now)">
            <input
              type="text"
              value={formData.transformation.beforeState}
              onChange={(e) => setFormData({
                ...formData,
                transformation: { ...formData.transformation, beforeState: e.target.value }
              })}
              className={`w-full px-4 py-2 border rounded-lg ${focusVisible}`}
              placeholder="e.g., Overwhelmed, frustrated, stuck"
            />
          </FormField>

          <FormField label="After State (How they'll feel)">
            <input
              type="text"
              value={formData.transformation.afterState}
              onChange={(e) => setFormData({
                ...formData,
                transformation: { ...formData.transformation, afterState: e.target.value }
              })}
              className={`w-full px-4 py-2 border rounded-lg ${focusVisible}`}
              placeholder="e.g., Confident, successful, empowered"
            />
          </FormField>
        </div>
      </div>

      {/* Pain Points & Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <h4 className="text-lg font-semibold mb-3">Pain Points</h4>
          <div className="space-y-2" role="group" aria-label="Pain points list">
            {formData.painPoints.map((point, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={point}
                  onChange={(e) => updateListItem('painPoints', index, e.target.value)}
                  placeholder="Enter a pain point"
                  className={`flex-1 px-3 py-2 border rounded-lg ${focusVisible}`}
                  aria-label={`Pain point ${index + 1}`}
                />
                {formData.painPoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem('painPoints', index)}
                    className={`p-2 text-red-600 hover:bg-red-50 rounded-lg ${focusVisible}`}
                    aria-label={`Remove pain point ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addListItem('painPoints')}
              className={`flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg ${focusVisible}`}
            >
              <Plus className="w-4 h-4" />
              Add Pain Point
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold mb-3">Goals</h4>
          <div className="space-y-2" role="group" aria-label="Goals list">
            {formData.goals.map((goal, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => updateListItem('goals', index, e.target.value)}
                  placeholder="Enter a goal"
                  className={`flex-1 px-3 py-2 border rounded-lg ${focusVisible}`}
                  aria-label={`Goal ${index + 1}`}
                />
                {formData.goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem('goals', index)}
                    className={`p-2 text-red-600 hover:bg-red-50 rounded-lg ${focusVisible}`}
                    aria-label={`Remove goal ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addListItem('goals')}
              className={`flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg ${focusVisible}`}
            >
              <Plus className="w-4 h-4" />
              Add Goal
            </button>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className={`px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg ${focusVisible}`}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={`px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg ${focusVisible}`}
        >
          {persona ? 'Update Persona' : 'Create Persona'}
        </button>
      </div>
    </form>
  );
};

const AudienceBuilder: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const announce = useAnnounce();
  const workshopState = useSelector(selectWorkshopState);
  const personas = workshopState?.audience?.personas || [];
  const primaryPersonaId = workshopState?.audience?.primaryPersonaId;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingPersona, setEditingPersona] = useState<AudiencePersona | undefined>();
  const [showTemplates, setShowTemplates] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleAddPersona = (personaData: Omit<AudiencePersona, 'id'>) => {
    const newPersona = {
      ...personaData,
      id: Date.now().toString()
    };
    dispatch(addPersona(newPersona));
    setIsEditing(false);
    setEditingPersona(undefined);
    
    // Set as primary if it's the first persona
    if (personas.length === 0) {
      dispatch(setPrimaryPersona(newPersona.id));
      announce(`Created and set ${personaData.name} as primary audience`);
    } else {
      announce(`Created persona: ${personaData.name}`);
    }
  };

  const handleUpdatePersona = (personaData: Omit<AudiencePersona, 'id'>) => {
    if (editingPersona) {
      dispatch(updatePersona({
        ...personaData,
        id: editingPersona.id
      }));
      setIsEditing(false);
      setEditingPersona(undefined);
      announce(`Updated persona: ${personaData.name}`);
    }
  };

  const handleDeletePersona = (id: string) => {
    const persona = personas.find(p => p.id === id);
    if (persona && confirm(`Are you sure you want to delete "${persona.name}"?`)) {
      dispatch(removePersona(id));
      announce(`Deleted persona: ${persona.name}`);
      
      // Set new primary if we deleted the primary
      if (primaryPersonaId === id && personas.length > 1) {
        const newPrimary = personas.find(p => p.id !== id);
        if (newPrimary) {
          dispatch(setPrimaryPersona(newPrimary.id));
        }
      }
    }
  };

  const handleSetPrimary = (id: string) => {
    const persona = personas.find(p => p.id === id);
    dispatch(setPrimaryPersona(id));
    if (persona) {
      announce(`Set ${persona.name} as primary audience`);
      setStatusMessage(`${persona.name} is now your primary audience`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleUseTemplate = (template: typeof personaTemplates[0]) => {
    setIsEditing(true);
    setEditingPersona({
      ...template,
      id: '',
      demographicInfo: {
        ageRange: '',
        experience: '',
        company_size: ''
      },
      transformation: {
        outcome: '',
        beforeState: '',
        afterState: ''
      }
    });
    setShowTemplates(false);
    announce(`Using ${template.name} template`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Define Your Target Audience</h2>
        <p className="text-lg text-gray-600">
          Create detailed personas of the people you want to reach. Understanding their challenges 
          and goals helps us craft messages that resonate.
        </p>
      </div>

      {/* Status message */}
      <LiveRegion>
        {statusMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg" role="status">
            {statusMessage}
          </div>
        )}
      </LiveRegion>

      {/* Quick Start Templates */}
      {!isEditing && personas.length === 0 && (
        <div className="mb-8 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Quick Start Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personaTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleUseTemplate(template)}
                className={`text-left p-4 bg-white rounded-lg hover:shadow-md transition-shadow ${focusVisible}`}
                aria-label={`Use ${template.name} template`}
              >
                <h4 className="font-semibold text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{template.role} - {template.industry}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona Form */}
      {isEditing && (
        <div className="mb-8">
          <PersonaForm
            persona={editingPersona}
            onSave={editingPersona?.id ? handleUpdatePersona : handleAddPersona}
            onCancel={() => {
              setIsEditing(false);
              setEditingPersona(undefined);
              announce('Cancelled persona editing');
            }}
          />
        </div>
      )}

      {/* Persona List */}
      {!isEditing && personas.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Your Personas</h3>
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${focusVisible}`}
            >
              <Plus className="w-4 h-4" />
              Add Persona
            </button>
          </div>
          
          <div 
            className="grid gap-4"
            role="list"
            aria-label="Audience personas"
          >
            {personas.map((persona) => (
              <div
                key={persona.id}
                className={`p-6 bg-white rounded-lg shadow-sm border-2 ${
                  primaryPersonaId === persona.id ? 'border-blue-500' : 'border-gray-200'
                }`}
                role="listitem"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-gray-400" />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {persona.name}
                        {primaryPersonaId === persona.id && (
                          <span className="ml-2 text-sm text-blue-600">(Primary)</span>
                        )}
                      </h4>
                      <p className="text-gray-600">{persona.role} - {persona.industry}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2" role="group" aria-label={`Actions for ${persona.name}`}>
                    {primaryPersonaId !== persona.id && (
                      <button
                        onClick={() => handleSetPrimary(persona.id)}
                        className={`p-2 text-blue-600 hover:bg-blue-50 rounded-lg ${focusVisible}`}
                        title="Set as primary"
                        aria-label={`Set ${persona.name} as primary audience`}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingPersona(persona);
                        setIsEditing(true);
                      }}
                      className={`p-2 text-gray-600 hover:bg-gray-50 rounded-lg ${focusVisible}`}
                      aria-label={`Edit ${persona.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePersona(persona.id)}
                      className={`p-2 text-red-600 hover:bg-red-50 rounded-lg ${focusVisible}`}
                      aria-label={`Delete ${persona.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {persona.transformation.outcome && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">
                      <Target className="w-4 h-4 inline mr-1" />
                      Transformation: {persona.transformation.outcome}
                    </p>
                    {persona.transformation.beforeState && persona.transformation.afterState && (
                      <p className="text-sm text-green-800 mt-1">
                        From {persona.transformation.beforeState} → To {persona.transformation.afterState}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {persona.painPoints.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Pain Points</h5>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {persona.painPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {persona.goals.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Goals</h5>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {persona.goals.map((goal, idx) => (
                          <li key={idx}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Persona Button (when not editing and have personas) */}
      {!isEditing && personas.length > 0 && personas.length < 5 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsEditing(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg ${focusVisible}`}
          >
            <Plus className="w-4 h-4" />
            Add Another Persona
          </button>
          <p className="text-sm text-gray-500 mt-2">
            You can create up to 5 personas ({personas.length}/5 used)
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-semibold mb-2">Tips for Creating Effective Personas:</p>
        <ul className="space-y-1">
          <li>• Be specific about their role and industry</li>
          <li>• Focus on real pain points you can address</li>
          <li>• Define clear transformation outcomes</li>
          <li>• Create 2-3 distinct personas for best results</li>
        </ul>
      </div>
    </div>
  );
};

export default AudienceBuilder;