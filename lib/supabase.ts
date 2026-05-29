import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  (Constants.expoConfig?.extra?.supabaseUrl as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Timespace] Supabase URL or anon key is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Task = {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  notes: string | null;
  color: string;
  recurrence_rule: string | null;
  notification_minutes_before: number | null;
  depth: number;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  target_value: number | null;
  unit: string | null;
  target_date: string | null;
  current_value: number;
  strategy_type: 'savings' | 'habit' | 'skill' | 'revenue' | 'custom' | null;
  linked_task_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
