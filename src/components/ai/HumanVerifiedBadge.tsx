export function HumanVerifiedBadge({ at }: { at: string | null }) {
  if (!at) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
      title={`Verified ${new Date(at).toLocaleString()}`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-3 w-3"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
          clipRule="evenodd"
        />
      </svg>
      Human verified
    </span>
  );
}
