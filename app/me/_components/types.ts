// app/me/_components/types.ts

export type TabKey = "profile" | "listings" | "verification" | "account" | "dashboard";

export type VendorType = "food" | "mall" | "student" | "other";

export type Me = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export type Vendor = {
  id: string;
  user_id: string;
  name: string | null;
  whatsapp: string | null;
  phone: string | null;
  location: string | null;
  vendor_type: VendorType | null;

  verified: boolean | null;
  verification_status: string | null;

  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;

  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;

  created_at?: string;
};

export type RoleFlags = {
  isVendor: boolean;
  isVerifiedVendor: boolean;
  isFoodVendor: boolean;
  isRider: boolean;
};
