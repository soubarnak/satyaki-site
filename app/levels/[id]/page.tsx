export default async function LevelPage({ params }: PageProps<"/levels/[id]">) {
  const { id } = await params;
  return (
    <>
      <h1>Level {id}</h1>
      <p>Level placeholder. Built by the lesson player ticket.</p>
    </>
  );
}
