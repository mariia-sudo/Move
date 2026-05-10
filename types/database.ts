export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          date_of_birth: string | null
          gender: 'male' | 'female' | null
          age: number | null
          weight_kg: number | null
          height_cm: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | null
          age?: number | null
          weight_kg?: number | null
          height_cm?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | null
          age?: number | null
          weight_kg?: number | null
          height_cm?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          sport_type: 'weightlifting' | 'running' | 'squash' | 'padel'
          date: string
          notes: string | null
          duration_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sport_type: 'weightlifting' | 'running' | 'squash' | 'padel'
          date: string
          notes?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sport_type?: 'weightlifting' | 'running' | 'squash' | 'padel'
          date?: string
          notes?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          id: string
          workout_id: string
          exercise: string
          sets: number
          reps: number
          weight_kg: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          exercise: string
          sets: number
          reps: number
          weight_kg?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          exercise?: string
          sets?: number
          reps?: number
          weight_kg?: number | null
          created_at?: string
        }
        Relationships: []
      }
      workout_cardio: {
        Row: {
          id: string
          workout_id: string
          distance_km: number
          duration_seconds: number
          avg_pace_per_km: number | null
          avg_heart_rate: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          distance_km: number
          duration_seconds: number
          avg_pace_per_km?: number | null
          avg_heart_rate?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          distance_km?: number
          duration_seconds?: number
          avg_pace_per_km?: number | null
          avg_heart_rate?: number | null
          created_at?: string
        }
        Relationships: []
      }
      workout_racket: {
        Row: {
          id: string
          workout_id: string
          opponent: string | null
          score: string | null
          result: 'win' | 'loss' | 'draw' | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          opponent?: string | null
          score?: string | null
          result?: 'win' | 'loss' | 'draw' | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          opponent?: string | null
          score?: string | null
          result?: 'win' | 'loss' | 'draw' | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cycle_logs: {
        Row: {
          id: string
          user_id: string
          period_start_date: string
          cycle_length_days: number
          period_length_days: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_start_date: string
          cycle_length_days: number
          period_length_days: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period_start_date?: string
          cycle_length_days?: number
          period_length_days?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number | null
          body_fat_percent: number | null
          muscle_mass_kg: number | null
          bone_mass_kg: number | null
          water_percent: number | null
          bmi: number | null
          visceral_fat: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          weight_kg?: number | null
          body_fat_percent?: number | null
          muscle_mass_kg?: number | null
          bone_mass_kg?: number | null
          water_percent?: number | null
          bmi?: number | null
          visceral_fat?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          weight_kg?: number | null
          body_fat_percent?: number | null
          muscle_mass_kg?: number | null
          bone_mass_kg?: number | null
          water_percent?: number | null
          bmi?: number | null
          visceral_fat?: number | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row']
export type Gender = 'male' | 'female'
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row']
export type WorkoutCardio = Database['public']['Tables']['workout_cardio']['Row']
export type WorkoutRacket = Database['public']['Tables']['workout_racket']['Row']
export type CycleLog = Database['public']['Tables']['cycle_logs']['Row']

export type SportType = 'weightlifting' | 'running' | 'squash' | 'padel'
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'
