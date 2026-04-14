// ============================================================================
// SPARKOS FITNESS - Root App Component
// ============================================================================

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorkoutProvider } from './components/workout/core';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import WorkoutDetail from './pages/WorkoutDetail';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Nutrition from './pages/Nutrition';
import Progress from './pages/Progress';
import BottomNav from './components/ui/BottomNav';
import OnboardingFlow, { OnboardingData } from './pages/OnboardingFlow';

// Placeholder item for WorkoutProvider
const placeholderItem = {
  id: 'temp-workout',
  title: 'אימון חדש',
  exercises: [] as any[],
};

// ============================================================================
// App Component
// ============================================================================

function App() {
  // Load theme from localStorage on mount
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('selectedTheme');
    return saved || 'deepCosmos';
  });

  // Onboarding state - check if user has completed onboarding
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [_onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const onboardingDone = localStorage.getItem('onboarding_completed');
    if (onboardingDone === 'true') {
      setShowOnboarding(false);
      // Load saved onboarding data into user profile
      const savedData = localStorage.getItem('onboarding_data');
      if (savedData) {
        try {
          const data: OnboardingData = JSON.parse(savedData);
          // Save to user profile
          localStorage.setItem('user_profile', JSON.stringify({
            name: data.name,
            age: data.age,
            height: data.height,
            weight: data.weight,
            gender: data.gender,
            weightGoal: getWeightGoalFromOnboarding(data.primaryGoal),
            activityLevel: getActivityLevelFromOnboarding(data.experienceLevel),
          }));
          // Save workout preferences
          localStorage.setItem('workout_prefs', JSON.stringify({
            defaultRestTime: data.restBetweenSets,
            autoStartRest: true,
            hapticsEnabled: true,
          }));
        } catch (e) {
          console.error('Error parsing onboarding data:', e);
        }
      }
    } else {
      setShowOnboarding(true);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('selectedTheme', theme);
  }, [theme]);

  // Handle onboarding completion
  const handleOnboardingComplete = (data: OnboardingData) => {
    // Save onboarding data
    localStorage.setItem('onboarding_data', JSON.stringify(data));
    localStorage.setItem('onboarding_completed', 'true');
    
    // Save to user profile (legacy format)
    localStorage.setItem('user_profile', JSON.stringify({
      name: data.name,
      age: data.age,
      height: data.height,
      weight: data.weight,
      gender: data.gender,
      weightGoal: getWeightGoalFromOnboarding(data.primaryGoal),
      activityLevel: getActivityLevelFromOnboarding(data.experienceLevel),
    }));
    
    // Save workout preferences
    localStorage.setItem('workout_prefs', JSON.stringify({
      defaultRestTime: data.restBetweenSets,
      autoStartRest: true,
      hapticsEnabled: true,
    }));
    
    setShowOnboarding(false);
    setOnboardingCompleted(true);
  };

  // Handle onboarding skip
  const handleOnboardingSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  // Show loading state while checking onboarding status
  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <>
        <OnboardingFlow 
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
        <AppContent theme={theme} setTheme={setTheme} />
      </>
    );
  }

  return <AppContent theme={theme} setTheme={setTheme} />;
}

// Separate component to render the main app content
function AppContent({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  return (
    <BrowserRouter>
      <DataProvider>
        <div className="app-container min-h-screen flex flex-col">
          {/* Main Content */}
          <main className="flex-1 pb-20">
            <Routes>
              <Route path="/" element={<Dashboard theme={theme} onThemeChange={setTheme} />} />
              <Route path="/workout" element={<WorkoutPlaceholder />} />
              <Route path="/workout/:templateId" element={<WorkoutPlaceholder />} />
              <Route path="/nutrition" element={<Nutrition />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id" element={<WorkoutDetail />} />
              <Route path="/settings" element={<Settings theme={theme} onThemeChange={setTheme} />} />
            </Routes>
          </main>

          {/* Bottom Navigation */}
          <BottomNav />
        </div>
      </DataProvider>
    </BrowserRouter>
  );
}

// ============================================================================
// Workout Placeholder - wraps the actual workout component
// ============================================================================

function WorkoutPlaceholder() {
  const [WorkoutComponent, setWorkoutComponent] = React.useState<React.ComponentType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    import('./components/workout/ActiveWorkoutNew')
      .then((mod) => setWorkoutComponent(() => mod.WorkoutContent as React.ComponentType))
      .catch((err) => {
        console.error('Failed to load workout:', err);
        setError('Failed to load workout');
      });
  }, []);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  if (!WorkoutComponent) {
    return (
      <div className="flex-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <WorkoutProvider
      item={placeholderItem}
      onUpdate={() => {}}
      onExit={() => window.history.back()}
    >
      <WorkoutComponent
        {...({
          item: placeholderItem,
          onUpdate: () => {},
          onExit: () => window.history.back()
        } as React.ComponentProps<typeof WorkoutComponent>)}
      />
    </WorkoutProvider>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWeightGoalFromOnboarding(goal: string): string {
  switch (goal) {
    case 'strength':
    case 'muscle':
      return 'עלייה במסה';
    case 'weight_loss':
      return 'ירידה במשקל';
    case 'endurance':
    case 'general':
    default:
      return 'שמירה על משקל';
  }
}

function getActivityLevelFromOnboarding(level: string): string {
  switch (level) {
    case 'beginner':
      return 'פעיל מעט';
    case 'intermediate':
      return 'פעיל מתון';
    case 'advanced':
      return 'פעיל מאוד';
    default:
      return 'פעיל מתון';
  }
}

export default App;
