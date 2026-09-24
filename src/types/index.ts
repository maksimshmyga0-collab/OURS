export * from './models';

// UI Backward Compatibility Aliases for components
export interface UserProfile {
  id?: string;
  name: string;
  avatarColor: string;
}


export interface CoupleState {
  id?: string;
  user: UserProfile;
  partner: UserProfile;
  inviteCode: string;
  connected: boolean;
  startDate: string;
  daysTogether: number;
  subscription: 'free' | 'premium';
  subscriptionTariff?: 'month' | 'year';
}

