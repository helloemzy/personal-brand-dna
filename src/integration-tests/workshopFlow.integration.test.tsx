import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import WorkshopContainer from '../components/workshop/WorkshopContainer';
import workshopReducer, { 
  setWorkshopStep,
  updateValues,
  updateTonePreferences,
  addAudiencePersona,
  updateWritingSample,
  updatePersonalityQuiz,
  completeWorkshop
} from '../store/slices/workshopSlice';
import authReducer, { setUser } from '../store/slices/authSlice';
import { workshopPersistence } from '../services/workshopPersistenceService';

// Mock the persistence service
jest.mock('../services/workshopPersistenceService', () => ({
  workshopPersistence: {
    getInstance: jest.fn(() => ({
      save: jest.fn().mockResolvedValue(true),
      load: jest.fn().mockResolvedValue(null),
      initialize: jest.fn(),
      setReduxStore: jest.fn()
    }))
  }
}));

// Mock the workshop API
jest.mock('../services/workshopAPI', () => ({
  workshopAPI: {
    saveProgress: jest.fn().mockResolvedValue({ data: { success: true } }),
    completeWorkshop: jest.fn().mockResolvedValue({ data: { success: true } })
  }
}));

// Mock components that would make external calls
jest.mock('../components/workshop/steps/WritingSample', () => {
  return function MockWritingSample({ onComplete }: any) {
    return (
      <div data-testid="writing-sample">
        <textarea
          data-testid="writing-sample-input"
          placeholder="Enter your writing sample"
          onChange={(e) => {
            if (e.target.value.length > 50) {
              onComplete({ text: e.target.value, wordCount: e.target.value.split(' ').length });
            }
          }}
        />
      </div>
    );
  };
});

describe('Workshop Flow Integration Tests', () => {
  let store: any;
  let user: any;

  beforeEach(() => {
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        workshop: workshopReducer,
        auth: authReducer
      }
    });

    // Set up a mock user
    user = {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    };
    store.dispatch(setUser(user));

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWorkshop = () => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <WorkshopContainer />
        </BrowserRouter>
      </Provider>
    );
  };

  test('should complete full workshop flow from start to finish', async () => {
    renderWorkshop();

    // Step 1: Values Audit
    expect(screen.getByText(/Values Audit/i)).toBeInTheDocument();
    
    // Select values
    const valueButtons = screen.getAllByRole('button', { name: /innovation|growth|integrity|impact|collaboration/i });
    expect(valueButtons.length).toBeGreaterThan(4);
    
    // Select 5 values
    fireEvent.click(valueButtons[0]); // innovation
    fireEvent.click(valueButtons[1]); // growth
    fireEvent.click(valueButtons[2]); // integrity
    fireEvent.click(valueButtons[3]); // impact
    fireEvent.click(valueButtons[4]); // collaboration

    // Click next
    const nextButton = screen.getByRole('button', { name: /next|continue/i });
    fireEvent.click(nextButton);

    // Step 2: Tone Preferences
    await waitFor(() => {
      expect(screen.getByText(/Tone Preferences/i)).toBeInTheDocument();
    });

    // Adjust tone sliders (in a real test, we'd interact with sliders)
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);

    // Continue to next step
    fireEvent.click(screen.getByRole('button', { name: /next|continue/i }));

    // Step 3: Audience Builder
    await waitFor(() => {
      expect(screen.getByText(/Audience Builder/i)).toBeInTheDocument();
    });

    // Fill in audience persona
    const audienceInputs = screen.getAllByRole('textbox');
    await userEvent.type(audienceInputs[0], 'Tech Entrepreneurs');
    if (audienceInputs[1]) await userEvent.type(audienceInputs[1], 'Startup Founders and CTOs');
    
    fireEvent.click(screen.getByRole('button', { name: /next|continue/i }));

    // Step 4: Writing Sample
    await waitFor(() => {
      expect(screen.getByTestId('writing-sample-upload')).toBeInTheDocument();
    });

    // Input writing sample
    const writingSampleInput = screen.getByTestId('writing-sample-input');
    await userEvent.type(
      writingSampleInput,
      'I help tech startups scale their products through innovative strategies and data-driven decision making. My approach combines technical expertise with business acumen.'
    );

    // Wait for the onComplete to be triggered
    await waitFor(() => {
      const state = store.getState();
      expect(state.workshop.writingSample.text).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /next|continue/i }));

    // Step 5: Personality Quiz
    await waitFor(() => {
      expect(screen.getByText(/Personality Quiz/i)).toBeInTheDocument();
    });

    // Answer quiz questions
    const quizAnswers = screen.getAllByRole('button', { name: /answer|option/i });
    if (quizAnswers.length > 0) {
      fireEvent.click(quizAnswers[0]);
    }

    // Complete workshop
    const completeButton = screen.getByRole('button', { name: /complete|finish/i });
    fireEvent.click(completeButton);

    // Verify workshop completion
    await waitFor(() => {
      const state = store.getState();
      expect(state.workshop.isCompleted).toBe(true);
      expect(state.workshop.completedSteps).toEqual([1, 2, 3, 4, 5]);
    });
  });

  test('should save progress at each step', async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    (workshopPersistence.getInstance as jest.Mock).mockReturnValue({
      save: mockSave,
      load: jest.fn().mockResolvedValue(null),
      initialize: jest.fn(),
      setReduxStore: jest.fn()
    });

    renderWorkshop();

    // Select values in step 1
    const valueButtons = screen.getAllByRole('button', { name: /innovation|growth/i });
    fireEvent.click(valueButtons[0]);
    fireEvent.click(valueButtons[1]);

    // Wait for auto-save
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify the saved state includes selected values
    const savedCall = mockSave.mock.calls[0];
    expect(savedCall[0].values.selected).toContain('innovation');
  });

  test('should validate required fields before allowing progression', async () => {
    renderWorkshop();

    // Try to proceed without selecting enough values
    const nextButton = screen.getByRole('button', { name: /next|continue/i });
    fireEvent.click(nextButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/select at least|minimum|required/i)).toBeInTheDocument();
    });

    // Select required values
    const valueButtons = screen.getAllByRole('button', { name: /innovation|growth|integrity|impact|collaboration/i });
    fireEvent.click(valueButtons[0]);
    fireEvent.click(valueButtons[1]);
    fireEvent.click(valueButtons[2]);
    fireEvent.click(valueButtons[3]);
    fireEvent.click(valueButtons[4]);

    // Now should be able to proceed
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Tone Preferences/i)).toBeInTheDocument();
    });
  });

  test('should handle navigation between steps', async () => {
    renderWorkshop();

    // Complete step 1
    const valueButtons = screen.getAllByRole('button', { name: /innovation|growth|integrity|impact|collaboration/i });
    valueButtons.slice(0, 5).forEach(button => fireEvent.click(button));
    fireEvent.click(screen.getByRole('button', { name: /next|continue/i }));

    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText(/Tone Preferences/i)).toBeInTheDocument();
    });

    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /back|previous/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/Values Audit/i)).toBeInTheDocument();
    });

    // Verify values are still selected
    const state = store.getState();
    expect(state.workshop.values.selected.length).toBe(5);
  });

  test('should load saved workshop state on mount', async () => {
    const savedState = {
      currentStep: 3,
      completedSteps: [1, 2],
      values: {
        selected: ['innovation', 'growth', 'impact'],
        custom: [],
        rankings: {},
        primary: [],
        aspirational: [],
        stories: {}
      },
      tonePreferences: {
        formal_casual: 20,
        concise_detailed: 0,
        analytical_creative: 30,
        serious_playful: -10
      }
    };

    (workshopPersistence.getInstance as jest.Mock).mockReturnValue({
      save: jest.fn().mockResolvedValue(true),
      load: jest.fn().mockResolvedValue(savedState),
      initialize: jest.fn(),
      setReduxStore: jest.fn()
    });

    renderWorkshop();

    // Should load at step 3
    await waitFor(() => {
      expect(screen.getByText(/Audience Builder/i)).toBeInTheDocument();
    });

    // Verify loaded state
    const state = store.getState();
    expect(state.workshop.currentStep).toBe(3);
    expect(state.workshop.values.selected).toEqual(['innovation', 'growth', 'impact']);
  });

  test('should handle errors gracefully', async () => {
    const mockSave = jest.fn().mockRejectedValue(new Error('Save failed'));
    (workshopPersistence.getInstance as jest.Mock).mockReturnValue({
      save: mockSave,
      load: jest.fn().mockResolvedValue(null),
      initialize: jest.fn(),
      setReduxStore: jest.fn()
    });

    renderWorkshop();

    // Select values
    const valueButtons = screen.getAllByRole('button', { name: /innovation/i });
    fireEvent.click(valueButtons[0]);

    // Wait for save attempt
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Should still be able to continue despite save failure
    expect(screen.getByText(/Values Audit/i)).toBeInTheDocument();
  });

  test('should track progress through progress indicator', async () => {
    renderWorkshop();

    // Check initial progress
    const progressSteps = screen.getAllByRole('listitem');
    expect(progressSteps[0]).toHaveClass('active');

    // Complete step 1
    const valueButtons = screen.getAllByRole('button', { name: /innovation|growth|integrity|impact|collaboration/i });
    valueButtons.slice(0, 5).forEach(button => fireEvent.click(button));
    fireEvent.click(screen.getByRole('button', { name: /next|continue/i }));

    // Check progress update
    await waitFor(() => {
      expect(progressSteps[0]).toHaveClass('completed');
      expect(progressSteps[1]).toHaveClass('active');
    });
  });
});