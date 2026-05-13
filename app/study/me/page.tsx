import StudyMeClient from "./StudyMeClient";

export const metadata = {
  title: "Study Profile",
  description: "Your Study Hub profile, saved resources, practice history and contributor tools.",
};

export default function StudyMePage() {
  return <StudyMeClient />;
}
