import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit2, Trash2, Users, Target, Briefcase, MessageSquare } from 'lucide-react';
import { 
  selectWorkshopState,
  addPersona,
  updatePersona,
  removePersona,
  AudiencePersona
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';

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

// Persona form component
const PersonaForm: React.FC<{
  persona?: AudiencePersona;
  onSave: (persona: Omit<AudiencePersona, 'id'>) => void;
  onCancel: () => void;
}> = ({ persona, onSave, onCancel }) => {
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
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      painPoints: formData.painPoints.filter(p => p.trim()),
      goals: formData.goals.filter(g => g.trim())
    });
  };

  const addListItem = (field: 'painPoints' | 'goals') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const updateListItem = (field: 'painPoints' | 'goals', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeListItem = (field: 'painPoints' | 'goals', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Persona Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Tech-Savvy Manager"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role/Title
          </label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Product Manager"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Industry
          </label>
          <input
            type="text"
            value={formData.industry}
            onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Technology, Finance"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Communication Style
          </label>
          <select
            value={formData.communicationStyle}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              communicationStyle: e.target.value as AudiencePersona['communicationStyle']
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="technical">Technical</option>
            <option value="conversational">Conversational</option>
          </select>
        </div>
      </div>

      {/* Pain Points */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pain Points
        </label>
        {formData.painPoints.map((point, index) => (
          <div key={index} className="flex mb-2">
            <input
              type="text"
              value={point}
              onChange={(e) => updateListItem('painPoints', index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter a pain point"
            />
            {formData.painPoints.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('painPoints', index)}
                className="ml-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('painPoints')}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add pain point
        </button>
      </div>

      {/* Goals */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Goals & Objectives
        </label>
        {formData.goals.map((goal, index) => (
          <div key={index} className="flex mb-2">
            <input
              type="text"
              value={goal}
              onChange={(e) => updateListItem('goals', index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter a goal"
            />
            {formData.goals.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('goals', index)}
                className="ml-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('goals')}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add goal
        </button>
      </div>

      {/* Optional Demographics */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Demographics (Optional)
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            value={formData.demographicInfo.ageRange || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              demographicInfo: { ...prev.demographicInfo, ageRange: e.target.value }
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Age range"
          />
          <input
            type="text"
            value={formData.demographicInfo.experience || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              demographicInfo: { ...prev.demographicInfo, experience: e.target.value }
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Experience level"
          />
          <input
            type="text"
            value={formData.demographicInfo.company_size || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              demographicInfo: { ...prev.demographicInfo, company_size: e.target.value }
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Company size"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {persona ? 'Update' : 'Create'} Persona
        </button>
      </div>
    </form>
  );
};

// Persona card component
const PersonaCard: React.FC<{
  persona: AudiencePersona;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ persona, onEdit, onDelete }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">{persona.name}</h4>
          <p className="text-sm text-gray-600">{persona.role} • {persona.industry}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start">
          <Target className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-gray-700 mb-1">Pain Points</p>
            <ul className="text-gray-600 space-y-0.5">
              {persona.painPoints.map((point, index) => (
                <li key={index}>• {point}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-start">
          <Briefcase className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-gray-700 mb-1">Goals</p>
            <ul className="text-gray-600 space-y-0.5">
              {persona.goals.map((goal, index) => (
                <li key={index}>• {goal}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center">
          <MessageSquare className="w-4 h-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">
            <span className="font-medium">Communication:</span> {persona.communicationStyle}
          </span>
        </div>
      </div>
    </div>
  );
};

// Main component
const AudienceBuilder: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { audiencePersonas } = useSelector(selectWorkshopState);
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<AudiencePersona | null>(null);

  const handleCreatePersona = (personaData: Omit<AudiencePersona, 'id'>) => {
    const newPersona: AudiencePersona = {
      ...personaData,
      id: `persona_${Date.now()}`
    };
    dispatch(addPersona(newPersona));
    setShowForm(false);
  };

  const handleUpdatePersona = (personaData: Omit<AudiencePersona, 'id'>) => {
    if (editingPersona) {
      dispatch(updatePersona({
        id: editingPersona.id,
        updates: personaData
      }));
      setEditingPersona(null);
      setShowForm(false);
    }
  };

  const handleDeletePersona = (id: string) => {
    if (window.confirm('Are you sure you want to delete this persona?')) {
      dispatch(removePersona(id));
    }
  };

  const handleEditPersona = (persona: AudiencePersona) => {
    setEditingPersona(persona);
    setShowForm(true);
  };

  const handleUseTemplate = (template: typeof personaTemplates[0]) => {
    const newPersona: AudiencePersona = {
      ...template,
      id: `persona_${Date.now()}`
    };
    dispatch(addPersona(newPersona));
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Build Your Target Audience
        </h2>
        <p className="text-gray-600">
          Create detailed personas of your ideal audience members. This helps generate content 
          that resonates with their specific needs and communication preferences.
        </p>
      </div>

      {/* Templates Section */}
      {audiencePersonas.length === 0 && !showForm && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Start Templates</h3>
          <div className="grid grid-cols-2 gap-3">
            {personaTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleUseTemplate(template)}
                className="text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {template.role} in {template.industry}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Section */}
      {showForm ? (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingPersona ? 'Edit Persona' : 'Create New Persona'}
          </h3>
          <PersonaForm
            persona={editingPersona ?? undefined}
            onSave={editingPersona ? handleUpdatePersona : handleCreatePersona}
            onCancel={() => {
              setShowForm(false);
              setEditingPersona(null);
            }}
          />
        </div>
      ) : (
        <>
          {/* Personas Grid */}
          {audiencePersonas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {audiencePersonas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onEdit={() => handleEditPersona(persona)}
                  onDelete={() => handleDeletePersona(persona.id)}
                />
              ))}
            </div>
          )}

          {/* Add Button */}
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center"
          >
            <Users className="w-5 h-5 mr-2" />
            {audiencePersonas.length === 0 ? 'Create Your First Persona' : 'Add Another Persona'}
          </button>
        </>
      )}

      {/* Summary */}
      {audiencePersonas.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>{audiencePersonas.length} persona{audiencePersonas.length > 1 ? 's' : ''}</strong> created. 
            Your content will be tailored to resonate with these specific audience segments.
          </p>
        </div>
      )}
    </div>
  );
};

export default AudienceBuilder;