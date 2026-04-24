export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div
          className="w-10 h-10 rounded-full border-2 border-accent-200 border-t-accent-500 animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    </div>
  );
}
