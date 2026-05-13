import { QuestionQualityClient } from "./QuestionQualityClient";

export default function StudyAdminQuestionQualityPage() {
  return (
    <QuestionQualityClient
      apiPath="/api/study-admin/questions/quality"
      authMode="study-admin"
      title="Question Quality"
      description="Inspect AI-generated questions, source coverage, repeated fingerprints, and missing metadata."
    />
  );
}
