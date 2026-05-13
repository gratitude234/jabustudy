export type ListingType = "product" | "service";

export type ListingCondition =
  | "new"
  | "fairly_used"
  | "used"
  | "for_parts";

export const LISTING_CONDITION_LABELS: Record<ListingCondition, string> = {
  new: "New",
  fairly_used: "Fairly used",
  used: "Used",
  for_parts: "For parts",
};

export type ListingRow = {
  id: string;
  vendor_id: string | null;
  title: string;
  description: string | null;
  listing_type: ListingType;
  category: string;
  /** Physical condition of the item — null for services or when not specified. */
  condition?: ListingCondition | null;
  price: number | null;
  price_label: string | null;
  location: string | null;
  image_url: string | null;
  /** Multi-image support — array of public URLs. Falls back to [image_url] if absent. */
  image_urls?: string[] | null;
  negotiable: boolean | null;
  status: "active" | "sold" | "inactive";
  created_at: string | null;
};

export type VendorType = "food" | "mall" | "student" | "other";

export type VendorVerificationStatus =
  | "unverified"
  | "requested"
  | "under_review"
  | "verified"
  | "rejected"
  | "suspended"
  | "pending"
  | "approved";

// Vendors can be joined in different places with different column sets,
// so most fields are optional here for flexibility.
export type VendorRow = {
  id: string;
  user_id?: string | null;
  name?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  location?: string | null;
  vendor_type?: VendorType | null;

  // Legacy flag (keep for backwards compatibility)
  verified?: boolean | null;

  // New verification system
  verification_status?: VendorVerificationStatus | null;
  verification_requested_at?: string | null;
  verified_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;

  // Food vendor fields
  description?: string | null;
  avatar_url?: string | null;
  accepts_orders?: boolean | null;
  accepts_delivery?: boolean | null;
  delivery_fee?: number | null;
  opens_at?: string | null;
  closes_at?: string | null;
  day_schedule?: any[] | null;
  pause_until?: string | null;
};

export type VendorVerificationRequestRow = {
  id: string;
  vendor_id: string;
  status: "requested" | "under_review" | "approved" | "rejected";
  note: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type VendorVerificationDocRow = {
  id: string;
  vendor_id: string;
  doc_type: string;
  file_path: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Study Hub — Practice engine types (moved from usePracticeEngine.ts — Step 2.5)
// ---------------------------------------------------------------------------

export type QuizSet = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  source_material_id?: string | null;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  explanation: string | null;
  ai_explanation?: string | null;
  question_kind?: string | null;
  difficulty_level?: string | null;
  cognitive_level?: string | null;
  source_topic?: string | null;
  question_fingerprint?: string | null;
  generation_meta?: Record<string, unknown> | null;
  study_ref?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  } | null;
  position: number | null;
};

export type QuizOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number | null;
};

export type ReviewTab = "all" | "wrong" | "flagged" | "unanswered";
export type CourierRow = {
  id: string;
  name: string;
  whatsapp: string;
  phone: string | null;
  base_location: string | null;
  areas_covered: string | null;
  hours: string | null;
  price_note: string | null;
  verified: boolean;
  active: boolean;
  featured?: boolean | null;
  created_at: string | null;
};

// Delivery agents directory / verification
export type RiderRow = {
  id: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  zone: string | null;
  zones_covered: string[];
  fee_note: string | null;
  is_available: boolean | null;
  verified: boolean;
  created_at: string | null;
  user_id: string | null;
  pin_hash: string | null;
  response_time_note: string | null;
  availability_note: string | null;
};
export type DeliveryStatus = "open" | "accepted" | "picked_up" | "delivered" | "cancelled";

export type DeliveryRequestRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  vendor_id: string | null;
  rider_id: string | null;
  dropoff: string;
  note: string | null;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
};
