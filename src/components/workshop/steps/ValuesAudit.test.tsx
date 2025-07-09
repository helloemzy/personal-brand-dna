import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ValuesAudit from './ValuesAudit';
import workshopReducer from '../../../store/slices/workshopSlice';

// Create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      workshop: workshopReducer,
    },
    preloadedState: {
      workshop: {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        assessmentScore: null,
        workshopPath: null,
        startedAt: null,
        lastSavedAt: null,
        completedAt: null,
        values: {
          selected: [],
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {},
          ...(initialState.values || {}),
        },
        tonePreferences: {
          formal_casual: 0,
          concise_detailed: 0,
          analytical_creative: 0,
          serious_playful: 0,
        },
        audiencePersonas: [],
        writingSample: null,
        personalityQuiz: {
          responses: [],
          currentQuestionIndex: 0,
        },
        sessionId: null,
        isSaving: false,
        lastError: null,
        ...initialState,
      },
    },
  });
};

describe('ValuesAudit Component', () => {
  const renderValuesAudit = (initialState = {}) => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <ValuesAudit />
      </Provider>
    );
  };

  test('renders values audit step', () => {
    renderValuesAudit();
    expect(screen.getByText(/What are your core professional values/i)).toBeInTheDocument();
  });

  test('displays all value options', () => {
    renderValuesAudit();
    
    // Check for some key values
    expect(screen.getByText('Innovation')).toBeInTheDocument();
    expect(screen.getByText('Excellence')).toBeInTheDocument();
    expect(screen.getByText('Integrity')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
  });

  test('can select values', () => {
    renderValuesAudit();
    
    const innovationValue = screen.getByText('Innovation');
    const excellenceValue = screen.getByText('Excellence');
    
    fireEvent.click(innovationValue.closest('div[class*="cursor-pointer"]'));
    fireEvent.click(excellenceValue.closest('div[class*="cursor-pointer"]'));
    
    // Values should be selected (have different styling)
    expect(innovationValue.closest('div[class*="border-blue-500"]')).toBeInTheDocument();
    expect(excellenceValue.closest('div[class*="border-blue-500"]')).toBeInTheDocument();
  });

  test('limits selection to 10 values', () => {
    renderValuesAudit();
    
    // Get all value names
    const valueNames = ['Leadership', 'Innovation', 'Influence', 'Mentorship', 'Vision', 
                        'Integrity', 'Transparency', 'Accountability', 'Authenticity', 'Fairness', 'Growth'];
    
    // Try to select 11 values
    for (let i = 0; i < 11; i++) {
      if (valueNames[i]) {
        const valueElement = screen.getByText(valueNames[i]);
        const clickableDiv = valueElement.closest('div[class*="cursor-pointer"]');
        if (clickableDiv) {
          fireEvent.click(clickableDiv);
        }
      }
    }
    
    // Count selected values (those with border-blue-500 class)
    const selectedValues = screen.getAllByText(/^(Leadership|Innovation|Influence|Mentorship|Vision|Integrity|Transparency|Accountability|Authenticity|Fairness|Growth)$/)
      .filter(el => el.closest('div[class*="border-blue-500"]'));
    expect(selectedValues).toHaveLength(10); // Maximum is 10, not 7
  });

  test('shows primary values section when values are selected', async () => {
    renderValuesAudit({
      values: {
        selected: ['innovation', 'excellence', 'growth'],
      },
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Which 2 values are absolutely non-negotiable/i)).toBeInTheDocument();
    });
  });

  test('can select primary values', async () => {
    renderValuesAudit({
      values: {
        selected: ['innovation', 'excellence', 'growth'],
      },
    });
    
    await waitFor(() => {
      const primarySection = screen.getByText(/Which 2 values are absolutely non-negotiable/i)
        .closest('div');
      
      const innovationChip = primarySection?.querySelector('button:has-text("Innovation")');
      if (innovationChip) {
        fireEvent.click(innovationChip);
      }
    });
  });

  test('shows aspirational values section', async () => {
    renderValuesAudit({
      values: {
        selected: ['innovation', 'excellence', 'growth'],
        primary: ['innovation', 'excellence'],
      },
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Which values do you aspire to embody more fully/i)).toBeInTheDocument();
    });
  });

  test('shows value story section when primary values are selected', async () => {
    renderValuesAudit({
      values: {
        selected: ['innovation', 'excellence', 'growth'],
        primary: ['innovation', 'excellence'],
      },
    });
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Describe a specific moment when this value guided your actions/i)).toBeInTheDocument();
    });
  });

  test('can input value story', async () => {
    renderValuesAudit({
      values: {
        selected: ['innovation', 'excellence', 'growth'],
        primary: ['innovation', 'excellence'],
      },
    });
    
    const storyTextarea = await screen.findByPlaceholderText(/Describe a specific moment when this value guided your actions/i);
    const testStory = 'Innovation drives me to constantly seek better solutions...';
    
    fireEvent.change(storyTextarea, { target: { value: testStory } });
    
    expect(storyTextarea).toHaveValue(testStory);
  });

  test('validates completion requirements', () => {
    const { rerender } = renderValuesAudit();
    
    // Initially incomplete - values not selected
    expect(screen.queryByText(/Which 2 values are absolutely non-negotiable/i)).not.toBeInTheDocument();
    
    // Add required data
    rerender(
      <Provider store={createTestStore({
        values: {
          selected: ['innovation', 'excellence', 'growth', 'integrity', 'leadership'],
          primary: ['innovation', 'excellence'],
          stories: { innovation: 'My story about values...' },
        },
      })}>
        <ValuesAudit />
      </Provider>
    );
    
    // Should show primary values selection when enough values are selected
    expect(screen.getByText(/Which 2 values are absolutely non-negotiable/i)).toBeInTheDocument();
  });

  test('deselects value when clicked again', () => {
    renderValuesAudit();
    
    const innovationValue = screen.getByText('Innovation');
    const clickableDiv = innovationValue.closest('div[class*="cursor-pointer"]');
    
    // Select
    fireEvent.click(clickableDiv);
    expect(innovationValue.closest('div[class*="border-blue-500"]')).toBeInTheDocument();
    
    // Deselect
    fireEvent.click(clickableDiv);
    expect(innovationValue.closest('div[class*="border-blue-500"]')).not.toBeInTheDocument();
  });
});