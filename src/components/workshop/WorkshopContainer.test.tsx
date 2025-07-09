import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { WorkshopContainer } from './WorkshopContainer';
import { configureStore } from '@reduxjs/toolkit';
import workshopReducer from '../../store/slices/workshopSlice';

// Create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      workshop: workshopReducer,
    },
    preloadedState: {
      workshop: {
        currentStep: 0,
        assessmentCompleted: true,
        selfAwarenessLevel: 'high',
        values: {
          selectedValues: [],
          primaryValues: [],
          aspirationalValues: [],
          valueStory: '',
        },
        tone: {
          formalityLevel: 50,
          technicality: 50,
          enthusiasm: 50,
          descriptors: [],
        },
        audience: {
          personas: [],
        },
        writing: {
          sample: '',
          promptId: '',
        },
        personality: {
          traits: {},
          responses: {},
        },
        ...initialState,
      },
    },
  });
};

describe('WorkshopContainer', () => {
  const renderWorkshop = (initialState = {}) => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <WorkshopContainer />
        </BrowserRouter>
      </Provider>
    );
  };

  test('renders workshop container', () => {
    renderWorkshop();
    expect(screen.getByText(/Brand House Workshop/i)).toBeInTheDocument();
  });

  test('shows current step', () => {
    renderWorkshop();
    // Should show Values Audit as the first step
    expect(screen.getByText(/Values Audit/i)).toBeInTheDocument();
  });

  test('navigation buttons are present', () => {
    renderWorkshop();
    expect(screen.getByText(/Next/i)).toBeInTheDocument();
    // Previous button might be disabled on first step
    const prevButton = screen.queryByText(/Previous/i);
    if (prevButton) {
      expect(prevButton).toBeDisabled();
    }
  });

  test('can navigate to next step', () => {
    renderWorkshop({
      values: {
        selectedValues: ['Innovation', 'Excellence'],
        primaryValues: ['Innovation', 'Excellence'],
        aspirationalValues: [],
        valueStory: 'Test story',
      },
    });

    const nextButton = screen.getByText(/Next/i);
    fireEvent.click(nextButton);
    
    // Should move to Tone Preferences
    expect(screen.getByText(/Tone Preferences/i)).toBeInTheDocument();
  });

  test('shows progress indicator', () => {
    renderWorkshop();
    // Look for step indicators
    const steps = screen.getAllByRole('listitem');
    expect(steps.length).toBeGreaterThan(0);
  });

  test('prevents navigation without required data', () => {
    renderWorkshop({
      values: {
        selectedValues: [], // No values selected
        primaryValues: [],
        aspirationalValues: [],
        valueStory: '',
      },
    });

    const nextButton = screen.getByText(/Next/i);
    expect(nextButton).toBeDisabled();
  });
});