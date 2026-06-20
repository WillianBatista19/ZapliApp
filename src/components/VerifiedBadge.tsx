export default function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role="img"
      aria-label="Conta verificada"
      className={`inline-block h-3.5 w-3.5 shrink-0 ${className}`}
    >
      <circle cx="8" cy="8" r="8" fill="#D4537E" />
      <path
        d="M4.5 8.2l2.2 2.3 4.3-4.8"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
