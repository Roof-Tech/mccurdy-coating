export function McCurdyLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="McCurdy Roofing"
    >
      {/* Roof shape */}
      <path
        d="M20 4L2 20h6v14h24V20h6L20 4z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M20 6L4 20h5v13h22V20h5L20 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Shield/M mark inside */}
      <path
        d="M14 22v8M20 18v12M26 22v8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M14 22l3-4 3 4 3-4 3 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
