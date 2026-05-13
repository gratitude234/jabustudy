// app/admin/study/practice/[setId]/page.tsx
import PracticeSetEditorClient from "./PracticeSetEditorClient";

// NOTE: In newer Next.js versions (e.g. 15+), `params` can be a Promise in Server Components.
// If you read `params.setId` directly, it becomes `undefined` and breaks UUID filters in Supabase.
export default async function PracticeSetEditorPage({
  params,
}: {
  params: { setId: string } | Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  return <PracticeSetEditorClient setId={setId} />;
}
