/**
 * Hand-rolled types matching supabase/schema.sql.
 *
 * Long-term: replace with `supabase gen types typescript --project-id …`
 * once we link the project locally. For now this keeps the API routes
 * type-safe without that dependency.
 */
export type Plan = "free" | "pro" | "team";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  trial_ends_at: string | null;
  trial_promo_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WaitlistPlatform = "mac" | "linux";

export interface WaitlistRow {
  id: number;
  email: string;
  platform: WaitlistPlatform;
  source: string | null;
  created_at: string;
  notified_at: string | null;
}

export interface SubscriptionRow {
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageLogRow {
  id: number;
  user_id: string;
  seconds_audio: number;
  bytes_upload: number;
  model: string;
  elapsed_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

// Supabase's GenericSchema expects these four keys to be objects, NOT
// `Record<string, never>` (the latter triggers `never` inference in `.from()`
// calls). Use empty index signatures instead.
type EmptyMap = { [k: string]: never };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow> & Pick<SubscriptionRow, "user_id">;
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLogRow;
        Insert: Omit<UsageLogRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<UsageLogRow>;
        Relationships: [];
      };
      waitlist: {
        Row: WaitlistRow;
        Insert: Omit<WaitlistRow, "id" | "created_at" | "notified_at"> & {
          id?: number;
          created_at?: string;
          notified_at?: string | null;
        };
        Update: Partial<WaitlistRow>;
        Relationships: [];
      };
    };
    Views: EmptyMap;
    Functions: EmptyMap;
    Enums: EmptyMap;
    CompositeTypes: EmptyMap;
  };
}
