import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContentTemplate } from '../services/contentAPI';

interface TemplateSelectorProps {
  templates: ContentTemplate[];
  selectedTemplateId: string;
  onTemplateSelect: (templateId: string) => void;
  contentType?: string;
  className?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onTemplateSelect,
  contentType,
  className = ''
}) => {
  const [filteredTemplates, setFilteredTemplates] = useState<ContentTemplate[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');
  const [showPreview, setShowPreview] = useState<string | null>(null);

  // Filter templates based on content type and use case
  useEffect(() => {
    let filtered = templates;

    // Filter by content type if specified
    if (contentType && contentType !== 'post') {
      filtered = filtered.filter(template => template.contentType === contentType);
    }

    // Filter by use case if selected
    if (selectedUseCase !== 'all') {
      filtered = filtered.filter(template => template.useCase === selectedUseCase);
    }

    setFilteredTemplates(filtered);
  }, [templates, contentType, selectedUseCase]);

  // Get unique use cases from templates
  const useCases = useMemo(() => 
    Array.from(new Set(templates.map(t => t.useCase))).filter(Boolean),
    [templates]
  );

  // Get template by ID for preview
  const getTemplateById = useCallback((id: string) => 
    templates.find(t => t.id === id),
    [templates]
  );

  const getUseCaseIcon = useCallback((useCase: string): string => {
    switch (useCase.toLowerCase()) {
      case 'professional_update':
        return '📢';
      case 'industry_insight':
        return '💡';
      case 'thought_leadership':
        return '🎯';
      case 'personal_story':
        return '📖';
      case 'company_news':
        return '🏢';
      case 'networking':
        return '🤝';
      case 'achievement':
        return '🏆';
      case 'learning':
        return '📚';
      case 'opinion':
        return '💭';
      case 'tip':
        return '💡';
      default:
        return '📝';
    }
  }, []);

  const formatUseCase = useCallback((useCase: string): string => {
    return useCase
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  const handleTemplateSelect = useCallback((id: string) => {
    onTemplateSelect(id);
  }, [onTemplateSelect]);

  const handlePreviewToggle = useCallback((e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    setShowPreview(showPreview === templateId ? null : templateId);
  }, [showPreview]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Template Selection Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Choose a Template</h3>
        <span className="text-sm text-gray-500">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
        </span>
      </div>

      {/* Use Case Filter */}
      {useCases.length > 1 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200">
          <button
            onClick={() => setSelectedUseCase('all')}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              selectedUseCase === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
            }`}
          >
            All Templates
          </button>
          {useCases.map((useCase) => (
            <button
              key={useCase}
              onClick={() => setSelectedUseCase(useCase)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors flex items-center space-x-1 ${
                selectedUseCase === useCase
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
              }`}
            >
              <span className="text-xs">{getUseCaseIcon(useCase)}</span>
              <span>{formatUseCase(useCase)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Auto-select Option */}
      <div className="space-y-2">
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            selectedTemplateId === ''
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
          onClick={() => handleTemplateSelect('')}
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🎯</div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Auto-Select Best Template</h4>
              <p className="text-sm text-gray-600">
                Let our AI choose the most effective template for your content type and industry
              </p>
            </div>
            {selectedTemplateId === '' && (
              <div className="text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Template List */}
        {filteredTemplates.length > 0 ? (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="relative">
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTemplateId === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{getUseCaseIcon(template.useCase)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => handlePreviewToggle(e, template.id)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            {showPreview === template.id ? 'Hide' : 'Preview'}
                          </button>
                          {selectedTemplateId === template.id && (
                            <div className="text-blue-600">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      
                      {/* Template Metadata */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {formatUseCase(template.useCase)}
                        </span>
                        {template.industryTags.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {template.industryTags.slice(0, 2).join(', ')}
                            {template.industryTags.length > 2 && ` +${template.industryTags.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Template Preview */}
                {showPreview === template.id && (
                  <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-2">Template Structure</h5>
                    <div className="text-sm text-gray-700 space-y-2">
                      {template.templateStructure.sections ? (
                        <div>
                          <p className="font-medium mb-1">Sections:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {template.templateStructure.sections.map((section: string, index: number) => (
                              <li key={index}>{section}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p>{template.templateStructure.description || 'Advanced template structure'}</p>
                      )}
                      
                      {template.variables && Object.keys(template.variables).length > 0 && (
                        <div>
                          <p className="font-medium mb-1">Customizable Elements:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(template.variables).map((variable) => (
                              <span
                                key={variable}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                              >
                                {variable.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-lg mb-1">No templates found</p>
            <p className="text-sm">
              {selectedUseCase !== 'all' 
                ? `No templates available for "${formatUseCase(selectedUseCase)}" use case.`
                : 'No templates match your current filters.'
              }
            </p>
            {selectedUseCase !== 'all' && (
              <button
                onClick={() => setSelectedUseCase('all')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All Templates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected Template Summary */}
      {selectedTemplateId && selectedTemplateId !== '' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="text-blue-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Selected: {getTemplateById(selectedTemplateId)?.name}
              </p>
              <p className="text-xs text-blue-700">
                This template will guide the structure and tone of your generated content
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TemplateSelector);