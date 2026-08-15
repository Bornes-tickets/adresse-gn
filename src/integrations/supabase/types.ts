export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          access_point_note: string | null
          accuracy_m: number | null
          beacon_id: string | null
          category: string
          commune_id: string | null
          created_at: string | null
          district_id: string | null
          id: string
          location: unknown
          name: string | null
          owner_id: string | null
          status: string
          updated_at: string | null
          verification_level: string
          visibility: string
        }
        Insert: {
          access_point_note?: string | null
          accuracy_m?: number | null
          beacon_id?: string | null
          category?: string
          commune_id?: string | null
          created_at?: string | null
          district_id?: string | null
          id?: string
          location?: unknown
          name?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string | null
          verification_level?: string
          visibility?: string
        }
        Update: {
          access_point_note?: string | null
          accuracy_m?: number | null
          beacon_id?: string | null
          category?: string
          commune_id?: string | null
          created_at?: string | null
          district_id?: string | null
          id?: string
          location?: unknown
          name?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string | null
          verification_level?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: true
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: true
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_current_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["canonical_commune_id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["legacy_commune_id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "addresses_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "addresses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["district_id"]
          },
          {
            foreignKeyName: "addresses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          active: boolean | null
          badge_number: string
          hired_at: string | null
          id: string
          zone_id: string | null
        }
        Insert: {
          active?: boolean | null
          badge_number: string
          hired_at?: string | null
          id: string
          zone_id?: string | null
        }
        Update: {
          active?: boolean | null
          badge_number?: string
          hired_at?: string | null
          id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_geo_current_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["canonical_commune_id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["legacy_commune_id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "agents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference_coverage"
            referencedColumns: ["commune_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          key_hash: string
          org_id: string | null
          quota_month: number | null
          scopes: string[] | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key_hash: string
          org_id?: string | null
          quota_month?: number | null
          scopes?: string[] | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key_hash?: string
          org_id?: string | null
          quota_month?: number | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          endpoint: string | null
          id: number
          key_id: string | null
          response_code: number | null
          ts: string | null
        }
        Insert: {
          endpoint?: string | null
          id?: number
          key_id?: string | null
          response_code?: number | null
          ts?: string | null
        }
        Update: {
          endpoint?: string | null
          id?: number
          key_id?: string | null
          response_code?: number | null
          ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beacon_categories: {
        Row: {
          code: string
          color: string
          created_at: string
          description: string | null
          icon: string
          is_active: boolean
          name: string
          position: number
          price_gnf: number | null
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          is_active?: boolean
          name: string
          position?: number
          price_gnf?: number | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          is_active?: boolean
          name?: string
          position?: number
          price_gnf?: number | null
        }
        Relationships: []
      }
      beacons: {
        Row: {
          activated_at: string | null
          assigned_agent_id: string | null
          category: string | null
          created_at: string | null
          id: string
          lot_id: string | null
          public_number: string
          qr_token: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          lot_id?: string | null
          public_number: string
          qr_token?: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          lot_id?: string | null
          public_number?: string
          qr_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "beacons_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "beacon_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "beacons_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          category: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          headquarters_address: string | null
          id: string
          legal_name: string | null
          owner_id: string
          plan_code: string | null
          plan_ends_at: string | null
          plan_started_at: string | null
          tax_id: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          headquarters_address?: string | null
          id?: string
          legal_name?: string | null
          owner_id: string
          plan_code?: string | null
          plan_ends_at?: string | null
          plan_started_at?: string | null
          tax_id?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          headquarters_address?: string | null
          id?: string
          legal_name?: string | null
          owner_id?: string
          plan_code?: string | null
          plan_ends_at?: string | null
          plan_started_at?: string | null
          tax_id?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_requests: {
        Row: {
          beacon_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence: string | null
          id: string
          requester_id: string
          status: string
          unclaimed_owner_id: string | null
        }
        Insert: {
          beacon_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: string | null
          id?: string
          requester_id: string
          status?: string
          unclaimed_owner_id?: string | null
        }
        Update: {
          beacon_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: string | null
          id?: string
          requester_id?: string
          status?: string
          unclaimed_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_unclaimed_owner_id_fkey"
            columns: ["unclaimed_owner_id"]
            isOneToOne: false
            referencedRelation: "unclaimed_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_faq: {
        Row: {
          answer: Json
          category: string | null
          created_at: string
          id: string
          position: number
          published: boolean
          question: Json
          updated_at: string
        }
        Insert: {
          answer?: Json
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question?: Json
          updated_at?: string
        }
        Update: {
          answer?: Json
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          body: Json
          cover_url: string | null
          created_at: string
          created_by: string | null
          excerpt: Json
          id: string
          position: number
          published_at: string | null
          seo_description: Json
          seo_title: Json
          slug: string
          status: string
          title: Json
          updated_at: string
        }
        Insert: {
          body?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          position?: number
          published_at?: string | null
          seo_description?: Json
          seo_title?: Json
          slug: string
          status?: string
          title?: Json
          updated_at?: string
        }
        Update: {
          body?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          position?: number
          published_at?: string | null
          seo_description?: Json
          seo_title?: Json
          slug?: string
          status?: string
          title?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: Json
          features: Json
          id: string
          name: Json
          period: string
          popular: boolean
          position: number
          price_gnf: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: Json
          features?: Json
          id?: string
          name?: Json
          period?: string
          popular?: boolean
          position?: number
          price_gnf?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: Json
          features?: Json
          id?: string
          name?: Json
          period?: string
          popular?: boolean
          position?: number
          price_gnf?: number
          updated_at?: string
        }
        Relationships: []
      }
      cms_posts: {
        Row: {
          body: Json
          category: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          excerpt: Json
          id: string
          published_at: string | null
          seo_description: Json
          seo_title: Json
          slug: string
          status: string
          title: Json
          updated_at: string
        }
        Insert: {
          body?: Json
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          published_at?: string | null
          seo_description?: Json
          seo_title?: Json
          slug: string
          status?: string
          title?: Json
          updated_at?: string
        }
        Update: {
          body?: Json
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: Json
          id?: string
          published_at?: string | null
          seo_description?: Json
          seo_title?: Json
          slug?: string
          status?: string
          title?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_translations: {
        Row: {
          ar: string | null
          created_at: string
          en: string | null
          fr: string | null
          id: string
          key: string
          namespace: string
          updated_at: string
        }
        Insert: {
          ar?: string | null
          created_at?: string
          en?: string | null
          fr?: string | null
          id?: string
          key: string
          namespace?: string
          updated_at?: string
        }
        Update: {
          ar?: string | null
          created_at?: string
          en?: string | null
          fr?: string | null
          id?: string
          key?: string
          namespace?: string
          updated_at?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          administrative_type: string | null
          boundary: unknown
          code: string | null
          geojson: Json | null
          id: string
          is_active: boolean
          name: string
          prefecture_id: string | null
          region_id: string | null
          slug: string | null
          source: string | null
          source_name: string | null
          stat_code: string | null
        }
        Insert: {
          administrative_type?: string | null
          boundary?: unknown
          code?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name: string
          prefecture_id?: string | null
          region_id?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Update: {
          administrative_type?: string | null
          boundary?: unknown
          code?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          prefecture_id?: string | null
          region_id?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_prefecture_id_fkey"
            columns: ["prefecture_id"]
            isOneToOne: false
            referencedRelation: "prefectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communes_prefecture_id_fkey"
            columns: ["prefecture_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["prefecture_id"]
          },
          {
            foreignKeyName: "communes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["region_id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      districts: {
        Row: {
          boundary: unknown
          code: string | null
          commune_id: string | null
          geojson: Json | null
          id: string
          is_active: boolean
          kind: string
          name: string
          official_reference: string | null
          slug: string | null
          source: string | null
          source_name: string | null
          source_year: number | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          boundary?: unknown
          code?: string | null
          commune_id?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          official_reference?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          source_year?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          boundary?: unknown
          code?: string | null
          commune_id?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          official_reference?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          source_year?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_current_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["canonical_commune_id"]
          },
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["legacy_commune_id"]
          },
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "districts_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference_coverage"
            referencedColumns: ["commune_id"]
          },
        ]
      }
      establishment_photos: {
        Row: {
          establishment_id: string | null
          id: string
          order: number | null
          url: string
        }
        Insert: {
          establishment_id?: string | null
          id?: string
          order?: number | null
          url: string
        }
        Update: {
          establishment_id?: string | null
          id?: string
          order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_photos_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address_id: string | null
          business_name: string
          cover_url: string | null
          description: string | null
          id: string
          opening_hours: Json | null
          phone: string | null
        }
        Insert: {
          address_id?: string | null
          business_name: string
          cover_url?: string | null
          description?: string | null
          id?: string
          opening_hours?: Json | null
          phone?: string | null
        }
        Update: {
          address_id?: string | null
          business_name?: string
          cover_url?: string | null
          description?: string | null
          id?: string
          opening_hours?: Json | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishments_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: true
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          alias: string | null
          beacon_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          alias?: string | null
          beacon_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          alias?: string | null
          beacon_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_import_runs: {
        Row: {
          created_at: string
          id: string
          imported_by: string | null
          localities_created: number
          localities_updated: number
          rows_received: number
          rows_skipped: number
          rows_valid: number
          sectors_created: number
          sectors_updated: number
          source_reference: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_by?: string | null
          localities_created?: number
          localities_updated?: number
          rows_received?: number
          rows_skipped?: number
          rows_valid?: number
          sectors_created?: number
          sectors_updated?: number
          source_reference: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_by?: string | null
          localities_created?: number
          localities_updated?: number
          rows_received?: number
          rows_skipped?: number
          rows_valid?: number
          sectors_created?: number
          sectors_updated?: number
          source_reference?: string
        }
        Relationships: []
      }
      geo_reference_gaps: {
        Row: {
          commune_name: string
          commune_stat_code: string
          created_at: string
          gap_reason: string
          is_resolved: boolean
          prefecture_name: string
          region_name: string
          source_required: string
          updated_at: string
        }
        Insert: {
          commune_name: string
          commune_stat_code: string
          created_at?: string
          gap_reason: string
          is_resolved?: boolean
          prefecture_name: string
          region_name: string
          source_required?: string
          updated_at?: string
        }
        Update: {
          commune_name?: string
          commune_stat_code?: string
          created_at?: string
          gap_reason?: string
          is_resolved?: boolean
          prefecture_name?: string
          region_name?: string
          source_required?: string
          updated_at?: string
        }
        Relationships: []
      }
      geo_reference_targets: {
        Row: {
          basis: string
          expected_count: number
          label: string
          level: string
          notes: string | null
          official_reference: string | null
          reference_key: string
          source_date: string | null
          updated_at: string
        }
        Insert: {
          basis: string
          expected_count: number
          label: string
          level: string
          notes?: string | null
          official_reference?: string | null
          reference_key: string
          source_date?: string | null
          updated_at?: string
        }
        Update: {
          basis?: string
          expected_count?: number
          label?: string
          level?: string
          notes?: string | null
          official_reference?: string | null
          reference_key?: string
          source_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      installation_measures: {
        Row: {
          accuracy_m: number | null
          id: string
          installation_id: string | null
          lat: number | null
          lng: number | null
          taken_at: string | null
        }
        Insert: {
          accuracy_m?: number | null
          id?: string
          installation_id?: string | null
          lat?: number | null
          lng?: number | null
          taken_at?: string | null
        }
        Update: {
          accuracy_m?: number | null
          id?: string
          installation_id?: string | null
          lat?: number | null
          lng?: number | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installation_measures_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_plans: {
        Row: {
          address_hint: string | null
          agent_id: string | null
          beacon_id: string | null
          commune_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          address_hint?: string | null
          agent_id?: string | null
          beacon_id?: string | null
          commune_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          address_hint?: string | null
          agent_id?: string | null
          beacon_id?: string | null
          commune_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_plans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_plans_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_plans_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_current_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["canonical_commune_id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_legacy_district_candidates"
            referencedColumns: ["legacy_commune_id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "installation_plans_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference_coverage"
            referencedColumns: ["commune_id"]
          },
          {
            foreignKeyName: "installation_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          accuracy_m: number | null
          agent_id: string | null
          beacon_id: string | null
          client_uuid: string | null
          gps_lat: number
          gps_lng: number
          id: string
          installed_at: string | null
          photo_url: string | null
          validated_at: string | null
          validator_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          agent_id?: string | null
          beacon_id?: string | null
          client_uuid?: string | null
          gps_lat: number
          gps_lng: number
          id?: string
          installed_at?: string | null
          photo_url?: string | null
          validated_at?: string | null
          validator_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          agent_id?: string | null
          beacon_id?: string | null
          client_uuid?: string | null
          gps_lat?: number
          gps_lng?: number
          id?: string
          installed_at?: string | null
          photo_url?: string | null
          validated_at?: string | null
          validator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_validator_id_fkey"
            columns: ["validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_gnf: number
          id: string
          issued_at: string | null
          number: string
          order_id: string | null
          paid_at: string | null
          pdf_url: string | null
          status: string
        }
        Insert: {
          amount_gnf?: number
          id?: string
          issued_at?: string | null
          number: string
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
        }
        Update: {
          amount_gnf?: number
          id?: string
          issued_at?: string | null
          number?: string
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          id: string
          lot_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          id?: string
          lot_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          id?: string
          lot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_assignments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_events: {
        Row: {
          actor_id: string | null
          attachment_url: string | null
          event_at: string
          event_type: string
          id: string
          lot_id: string
          notes: string | null
        }
        Insert: {
          actor_id?: string | null
          attachment_url?: string | null
          event_at?: string
          event_type: string
          id?: string
          lot_id: string
          notes?: string | null
        }
        Update: {
          actor_id?: string | null
          attachment_url?: string | null
          event_at?: string
          event_type?: string
          id?: string
          lot_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lot_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          category: string | null
          code: string
          delivery_note_url: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          priority: string
          qc_passed: boolean | null
          quantity: number
          received_at: string | null
          sent_at: string | null
          status: string
          supplier: string | null
          supplier_order_ref: string | null
        }
        Insert: {
          category?: string | null
          code: string
          delivery_note_url?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          priority?: string
          qc_passed?: boolean | null
          quantity: number
          received_at?: string | null
          sent_at?: string | null
          status?: string
          supplier?: string | null
          supplier_order_ref?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          delivery_note_url?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          priority?: string
          qc_passed?: boolean | null
          quantity?: number
          received_at?: string | null
          sent_at?: string | null
          status?: string
          supplier?: string | null
          supplier_order_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "beacon_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          read: boolean | null
          read_at: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read?: boolean | null
          read_at?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read?: boolean | null
          read_at?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_gnf: number
          beacon_id: string | null
          business_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          items: Json
          notes: string | null
          offer_code: string
          order_ref: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount_gnf: number
          beacon_id?: string | null
          business_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          offer_code: string
          order_ref?: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount_gnf?: number
          beacon_id?: string | null
          business_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          offer_code?: string
          order_ref?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_id: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          contact_id?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          contact_id?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks: {
        Row: {
          error: string | null
          headers: Json | null
          id: string
          payload: Json | null
          processed: boolean
          provider: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          error?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
          processed?: boolean
          provider: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          error?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
          processed?: boolean
          provider?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_gnf: number
          confirmed_at: string | null
          confirmed_by: string | null
          external_ref: string | null
          id: string
          intent_id: string | null
          order_id: string | null
          paid_at: string | null
          provider: string | null
          status: string
          webhook_payload: Json | null
        }
        Insert: {
          amount_gnf: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          external_ref?: string | null
          id?: string
          intent_id?: string | null
          order_id?: string | null
          paid_at?: string | null
          provider?: string | null
          status?: string
          webhook_payload?: Json | null
        }
        Update: {
          amount_gnf?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          external_ref?: string | null
          id?: string
          intent_id?: string | null
          order_id?: string | null
          paid_at?: string | null
          provider?: string | null
          status?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_installation_docs: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          mime_type: string | null
          pending_installation_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          pending_installation_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          pending_installation_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_installation_docs_pending_installation_id_fkey"
            columns: ["pending_installation_id"]
            isOneToOne: false
            referencedRelation: "pending_installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installation_docs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installation_docs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_installations: {
        Row: {
          assigned_agent_id: string | null
          beacon_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          note: string | null
          order_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          beacon_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          beacon_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_installations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installations_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installations_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      prefectures: {
        Row: {
          code: string | null
          created_at: string
          geojson: Json | null
          id: string
          is_active: boolean
          is_special_zone: boolean
          name: string
          region_id: string
          slug: string
          source: string | null
          source_name: string | null
          stat_code: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          geojson?: Json | null
          id?: string
          is_active?: boolean
          is_special_zone?: boolean
          name: string
          region_id: string
          slug: string
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          geojson?: Json | null
          id?: string
          is_active?: boolean
          is_special_zone?: boolean
          name?: string
          region_id?: string
          slug?: string
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefectures_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prefectures_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["region_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json
          role: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json
          role?: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json
          role?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          ip: string
          minute_bucket: string
        }
        Insert: {
          count?: number
          ip: string
          minute_bucket: string
        }
        Update: {
          count?: number
          ip?: string
          minute_bucket?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          country_code: string
          country_id: string | null
          geojson: Json | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          source: string | null
          source_name: string | null
          stat_code: string | null
        }
        Insert: {
          code: string
          country_code?: string
          country_id?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Update: {
          code?: string
          country_code?: string
          country_id?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          source?: string | null
          source_name?: string | null
          stat_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          beacon_id: string | null
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reporter_id: string | null
          status: string
        }
        Insert: {
          beacon_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          status?: string
        }
        Update: {
          beacon_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_logs: {
        Row: {
          beacon_id: string | null
          id: string
          launched_at: string | null
          provider: string | null
          user_id: string | null
        }
        Insert: {
          beacon_id?: string | null
          id?: string
          launched_at?: string | null
          provider?: string | null
          user_id?: string | null
        }
        Update: {
          beacon_id?: string | null
          id?: string
          launched_at?: string | null
          provider?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_logs_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_logs_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          beacon_id_found: string | null
          created_at: string | null
          id: string
          ip: unknown
          query: string
          user_id: string | null
        }
        Insert: {
          beacon_id_found?: string | null
          created_at?: string | null
          id?: string
          ip?: unknown
          query: string
          user_id?: string | null
        }
        Update: {
          beacon_id_found?: string | null
          created_at?: string | null
          id?: string
          ip?: unknown
          query?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_beacon_id_found_fkey"
            columns: ["beacon_id_found"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_logs_beacon_id_found_fkey"
            columns: ["beacon_id_found"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_misses: {
        Row: {
          blocked_until: string | null
          ip: string
          miss_count: number
          updated_at: string
        }
        Insert: {
          blocked_until?: string | null
          ip: string
          miss_count?: number
          updated_at?: string
        }
        Update: {
          blocked_until?: string | null
          ip?: string
          miss_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          code: string | null
          created_at: string
          district_id: string
          geojson: Json | null
          id: string
          is_active: boolean
          name: string
          official_reference: string | null
          slug: string
          source: string | null
          source_name: string | null
          source_year: number | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          district_id: string
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name: string
          official_reference?: string | null
          slug: string
          source?: string | null
          source_name?: string | null
          source_year?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          district_id?: string
          geojson?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          official_reference?: string | null
          slug?: string
          source?: string | null
          source_name?: string | null
          source_year?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sectors_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["district_id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          customer_id: string | null
          end_date: string
          id: string
          next_billing_date: string | null
          plan_code: string
          price_gnf: number
          start_date: string
          status: string
        }
        Insert: {
          auto_renew?: boolean
          customer_id?: string | null
          end_date: string
          id?: string
          next_billing_date?: string | null
          plan_code: string
          price_gnf: number
          start_date: string
          status?: string
        }
        Update: {
          auto_renew?: boolean
          customer_id?: string | null
          end_date?: string
          id?: string
          next_billing_date?: string | null
          plan_code?: string
          price_gnf?: number
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          business_id: string
          id: string
          invited_at: string
          joined_at: string | null
          member_id: string
          role: string
        }
        Insert: {
          business_id: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          member_id: string
          role?: string
        }
        Update: {
          business_id?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          member_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unclaimed_owners: {
        Row: {
          beacon_id: string
          consent_at: string | null
          created_at: string
          id: string
          name: string | null
          phone: string | null
        }
        Insert: {
          beacon_id: string
          consent_at?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          beacon_id?: string
          consent_at?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unclaimed_owners_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unclaimed_owners_beacon_id_fkey"
            columns: ["beacon_id"]
            isOneToOne: false
            referencedRelation: "beacons_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      beacons_public: {
        Row: {
          activated_at: string | null
          category: string | null
          created_at: string | null
          id: string | null
          lot_id: string | null
          public_number: string | null
          status: string | null
        }
        Insert: {
          activated_at?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          lot_id?: string | null
          public_number?: string | null
          status?: string | null
        }
        Update: {
          activated_at?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          lot_id?: string | null
          public_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beacons_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "beacon_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "beacons_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_geo_current_coverage: {
        Row: {
          commune_id: string | null
          commune_name: string | null
          commune_stat_code: string | null
          coverage_status: string | null
          current_quartiers_districts: number | null
          current_sectors: number | null
          prefecture_name: string | null
          region_name: string | null
        }
        Relationships: []
      }
      v_geo_legacy_district_candidates: {
        Row: {
          candidate_count: number | null
          canonical_commune_id: string | null
          canonical_commune_name: string | null
          canonical_stat_code: string | null
          legacy_commune_id: string | null
          legacy_commune_name: string | null
          region_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "v_geo_reference"
            referencedColumns: ["region_id"]
          },
        ]
      }
      v_geo_reference: {
        Row: {
          administrative_type: string | null
          commune: string | null
          commune_id: string | null
          commune_official_code: string | null
          commune_stat_code: string | null
          district_id: string | null
          local_type: string | null
          prefecture: string | null
          prefecture_id: string | null
          prefecture_stat_code: string | null
          quartier_district: string | null
          region: string | null
          region_code: string | null
          region_id: string | null
          region_stat_code: string | null
          secteur: string | null
          sector_id: string | null
        }
        Relationships: []
      }
      v_geo_reference_coverage: {
        Row: {
          administrative_type: string | null
          commune: string | null
          commune_id: string | null
          commune_stat_code: string | null
          coverage_status: string | null
          localites_courantes_verifiees: number | null
          localites_historiques: number | null
          prefecture: string | null
          quartiers_districts: number | null
          region: string | null
          secteurs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_delete_geo_zone: {
        Args: { p_id: string; p_niveau: string }
        Returns: undefined
      }
      admin_geo_zones: { Args: never; Returns: Json }
      admin_import_current_geo_rows: {
        Args: { p_rows: Json; p_source_reference?: string }
        Returns: Json
      }
      admin_import_geo_rows: { Args: { p_rows: Json }; Returns: Json }
      admin_save_geo_zone: {
        Args: {
          p_code?: string
          p_geojson?: Json
          p_kind?: string
          p_name: string
          p_niveau: string
          p_parent_id?: string
        }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geo_current_summary: { Args: never; Returns: Json }
      geo_is_admin: { Args: never; Returns: boolean }
      geo_slug: { Args: { p_value: string }; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      next_invoice_ref: { Args: never; Returns: string }
      next_order_ref: { Args: never; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      search_by_number: {
        Args: { p_number: string }
        Returns: {
          access_point_note: string
          business_name: string
          category: string
          cover_url: string
          description: string
          lat: number
          lng: number
          name: string
          opening_hours: Json
          phone: string
          public_number: string
          verification_level: string
          visibility: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
