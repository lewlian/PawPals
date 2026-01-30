import { Scenes, Context } from 'telegraf';

// Database session entity
export interface Session {
  id: number;
  userId: number;
  locationId: number;
  checkedInAt: Date;
  expiresAt: Date;
  checkedOutAt: Date | null;
  status: 'active' | 'expired' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

// Check-in wizard state
export interface CheckInWizardState {
  locationId?: number;
  locationName?: string;
  selectedDogIds?: number[];
  durationMinutes?: number;
  userId?: number;
  allDogIds?: number[];
}

// Wizard state for profile creation flow - custom data stored during wizard
export interface ProfileWizardState {
  dogData: {
    name?: string;
    size?: 'Small' | 'Medium' | 'Large';
    breed?: string;
    age?: number;
  };
}

// Scene session data with wizard support
export interface SceneSessionData extends Scenes.WizardSessionData {
  // Custom profile wizard state
  profileWizard?: ProfileWizardState;
}

// Session data persisted across messages
export interface SessionData extends Scenes.WizardSession<SceneSessionData> {
  userId?: number; // Database user ID once resolved
}

// Bot context with session and scene support
export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, SceneSessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
