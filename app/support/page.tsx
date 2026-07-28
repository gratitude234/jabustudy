// app/support/page.tsx
//
// Public-facing maintenance-contribution page. This is the landing target for
// announcement pushes — bank details live here, on the verified domain, and
// never inside a notification body.

import type { Metadata } from "next";
import { getBankDetails } from "@/lib/studyBilling";
import SupportClient from "./SupportClient";

export const metadata: Metadata = {
  title: "Support JabuStudy",
  description:
    "JabuStudy is free for every JABU student. Maintenance contributions keep hosting, the domain, and AI features running.",
};

export default function SupportPage() {
  const bank = getBankDetails();

  return (
    <SupportClient
      bankName={bank.bankName}
      accountNumber={bank.accountNumber}
      accountName={bank.accountName}
    />
  );
}
