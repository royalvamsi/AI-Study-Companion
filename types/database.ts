export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          updated_at?: string;
        };
      };
      spaces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          name: string;
          description: string | null;
          learning_goal: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          name: string;
          description?: string | null;
          learning_goal?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          learning_goal?: string | null;
          updated_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: string;
          status: "queued" | "processing" | "ready" | "failed";
          page_count: number | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type?: string;
          status?: "queued" | "processing" | "ready" | "failed";
          page_count?: number | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "processing" | "ready" | "failed";
          page_count?: number | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      material_chunks: {
        Row: {
          id: string;
          material_id: string;
          project_id: string;
          content: string;
          chunk_index: number;
          page_number: number | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          project_id: string;
          content: string;
          chunk_index: number;
          page_number?: number | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          embedding?: number[] | null;
        };
      };
      concepts: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          source_material_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          source_material_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          sources: Json | null;
          evidence_state: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "INSUFFICIENT_EVIDENCE" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          sources?: Json | null;
          evidence_state?: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "INSUFFICIENT_EVIDENCE" | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          sources?: Json | null;
        };
      };
      learning_context: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          learning_goal: string | null;
          strengths: string[];
          weaknesses: string[];
          preferences: string[];
          important_context: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          learning_goal?: string | null;
          strengths?: string[];
          weaknesses?: string[];
          preferences?: string[];
          important_context?: string[];
          updated_at?: string;
        };
        Update: {
          learning_goal?: string | null;
          strengths?: string[];
          weaknesses?: string[];
          preferences?: string[];
          important_context?: string[];
          updated_at?: string;
        };
      };
      concept_mastery: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          concept_id: string;
          mastery_score: number;
          previous_score: number | null;
          trend: "IMPROVING" | "STABLE" | "NEEDS_ATTENTION" | null;
          assessment_count: number;
          last_assessed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          concept_id: string;
          mastery_score?: number;
          previous_score?: number | null;
          trend?: "IMPROVING" | "STABLE" | "NEEDS_ATTENTION" | null;
          assessment_count?: number;
          last_assessed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          mastery_score?: number;
          previous_score?: number | null;
          trend?: "IMPROVING" | "STABLE" | "NEEDS_ATTENTION" | null;
          assessment_count?: number;
          last_assessed_at?: string | null;
          updated_at?: string;
        };
      };
      mistakes: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          concept_id: string | null;
          question_id: string | null;
          mistake_type: string | null;
          description: string | null;
          occurrence_count: number;
          last_occurred_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          concept_id?: string | null;
          question_id?: string | null;
          mistake_type?: string | null;
          description?: string | null;
          occurrence_count?: number;
          last_occurred_at?: string;
        };
        Update: {
          occurrence_count?: number;
          last_occurred_at?: string;
          description?: string | null;
        };
      };
      assessments: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          status: "in_progress" | "completed" | "abandoned";
          question_count: number;
          score: number | null;
          started_at: string;
          completed_at: string | null;
          mastery_processed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          status?: "in_progress" | "completed" | "abandoned";
          question_count?: number;
          score?: number | null;
          started_at?: string;
          completed_at?: string | null;
          mastery_processed_at?: string | null;
        };
        Update: {
          status?: "in_progress" | "completed" | "abandoned";
          question_count?: number;
          score?: number | null;
          completed_at?: string | null;
          mastery_processed_at?: string | null;
        };
      };
      assessment_questions: {
        Row: {
          id: string;
          assessment_id: string;
          concept_id: string | null;
          question_type: "mcq" | "open_ended";
          question_text: string;
          options: Json | null;
          correct_answer: string | null;
          difficulty: number | null;
          llm_response: Json | null;
          user_answer: string | null;
          is_correct: boolean | null;
          score: number | null;
          feedback: string | null;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          concept_id?: string | null;
          question_type: "mcq" | "open_ended";
          question_text: string;
          options?: Json | null;
          correct_answer?: string | null;
          difficulty?: number | null;
          llm_response?: Json | null;
          user_answer?: string | null;
          is_correct?: boolean | null;
          score?: number | null;
          feedback?: string | null;
          answered_at?: string | null;
        };
        Update: {
          user_answer?: string | null;
          is_correct?: boolean | null;
          score?: number | null;
          feedback?: string | null;
          answered_at?: string | null;
        };
      };
      recommendations: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          concept_id: string | null;
          priority: "HIGH" | "MEDIUM" | "LOW";
          action_type: string;
          reasoning: string | null;
          is_dismissed: boolean;
          status: "active" | "superseded" | "resolved";
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          concept_id?: string | null;
          priority?: "HIGH" | "MEDIUM" | "LOW";
          action_type: string;
          reasoning?: string | null;
          is_dismissed?: boolean;
          status?: "active" | "superseded" | "resolved";
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          priority?: "HIGH" | "MEDIUM" | "LOW";
          action_type?: string;
          reasoning?: string | null;
          is_dismissed?: boolean;
          status?: "active" | "superseded" | "resolved";
          updated_at?: string;
        };
      };
      activity_events: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          event_type: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          user_id: string;
          event_type: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: never;
      };
      ai_usage_logs: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          feature: string;
          model: string;
          latency_ms: number | null;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          status: "success" | "error";
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          feature: string;
          model: string;
          latency_ms?: number | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          estimated_cost_usd?: number | null;
          status?: "success" | "error";
          error?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          match_project_id: string;
          match_count?: number;
          match_threshold?: number;
        };
        Returns: Array<{
          id: string;
          material_id: string;
          content: string;
          page_number: number | null;
          similarity: number;
        }>;
      };
    };
    Enums: {
      material_status: "queued" | "processing" | "ready" | "failed";
      evidence_state: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "INSUFFICIENT_EVIDENCE";
      message_role: "user" | "assistant" | "system";
      assessment_status: "in_progress" | "completed" | "abandoned";
      question_type: "mcq" | "open_ended";
    };
    CompositeTypes: Record<string, never>;
  };
}
