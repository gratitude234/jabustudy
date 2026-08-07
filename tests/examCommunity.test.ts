import { describe, expect, it } from "vitest";

import {
  getExamSprintCommunityUrl,
  getExamSprintWhatsAppDestinationType,
  normalizeExamSprintCommunityUrl,
} from "../lib/examSprint/community";

describe("Exam Sprint community URL", () => {
  it("accepts a secure WhatsApp community invite", () => {
    expect(normalizeExamSprintCommunityUrl(" https://chat.whatsapp.com/ExampleInvite123 "))
      .toBe("https://chat.whatsapp.com/ExampleInvite123");
    expect(getExamSprintWhatsAppDestinationType("https://chat.whatsapp.com/ExampleInvite123"))
      .toBe("community");
  });

  it("accepts the WhatsApp Channel used for Exam Sprint updates", () => {
    const channel = "https://whatsapp.com/channel/0029Vb8pzHQ4NVii9SpQj32k";
    expect(normalizeExamSprintCommunityUrl(channel)).toBe(channel);
    expect(getExamSprintWhatsAppDestinationType(channel)).toBe("channel");
    expect(normalizeExamSprintCommunityUrl("https://www.whatsapp.com/channel/ExampleChannel123"))
      .toBe("https://www.whatsapp.com/channel/ExampleChannel123");
  });

  it("stays hidden when the invite is missing or unsafe", () => {
    expect(normalizeExamSprintCommunityUrl(undefined)).toBeNull();
    expect(normalizeExamSprintCommunityUrl("http://chat.whatsapp.com/ExampleInvite123")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://chat.whatsapp.com.evil.test/ExampleInvite123")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://chat.whatsapp.com/")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://whatsapp.com/channel/")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://whatsapp.com/status/ExampleStatus")).toBeNull();
    expect(normalizeExamSprintCommunityUrl("https://whatsapp.com.evil.test/channel/ExampleChannel")).toBeNull();
  });

  it("uses only the dedicated Exam Sprint community setting", () => {
    expect(getExamSprintCommunityUrl({})).toBeNull();
    expect(getExamSprintCommunityUrl({
      NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL: "https://chat.whatsapp.com/CommunityInvite",
    })).toBe("https://chat.whatsapp.com/CommunityInvite");
    expect(getExamSprintCommunityUrl({
      NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL: "https://whatsapp.com/channel/0029Vb8pzHQ4NVii9SpQj32k",
    })).toBe("https://whatsapp.com/channel/0029Vb8pzHQ4NVii9SpQj32k");
  });
});
