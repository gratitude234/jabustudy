import { redirect } from "next/navigation";
import { isExamSprintOnlyMode } from "@/lib/systemMode";

export default function HomePage() {
  redirect(isExamSprintOnlyMode() ? "/exam" : "/study");
}
