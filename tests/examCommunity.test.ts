import { describe, expect, it } from "vitest";

import {
  getExamSprintCommunityUrl,
  normalizeExamSprintCommunityUrl,
} from "../lib/examSprint/community";

describe("Exam Sprint community URL", () => {
  it("accepts a secure WhatsApp community invite", () => {
    expect(normalizeExamSprintCommunityUrl(" https://chat.whatsapp.com/ExampleInvite123 "))
      .toBe("https://chat.whatsapp.com/ExampleInvite123");
  });

  it("stays hidden when the invite is missing or unsafe", () => {
    expect(normalizeExamSprintCommunityUrl(undefined)).toBeNull();
    expect(normalizeExamSprintCommunityUrl("http://chat.whatsapp.com/ExampleInvite123")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://chat.whatsapp.com.evil.test/ExampleInvite123")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://chat.whatsapp.com/")).toBeNull();
  });

  it("uses only the dedicated Exam Sprint community setting", () => {
    expect(getExamSprintCommunityUrl({})).toBeNull();
    expect(getExamSprintCommunityUrl({
      NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL: "https://chat.whatsapp.com/CommunityInvite",
    })).toBe("https://chat.whatsapp.com/CommunityInvite");
  });
});
