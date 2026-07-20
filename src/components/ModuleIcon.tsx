// ModuleIcon — egységes, vonalas ikonkészlet a modulokhoz (currentColor-t használ).
import type { JSX } from "react";

const paths: Record<string, JSX.Element> = {
  valuation: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
      <path d="M12 3v3" />
    </>
  ),
  land: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  visualization: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="m3 15 4-4 3 3 5-5 6 6" />
      <circle cx="8.5" cy="9" r="1.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="m17 9 4-2v10l-4-2" />
      <path d="m10 9 4 3-4 3V9Z" />
    </>
  ),
  flyer: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  branding: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </>
  ),
  custom: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  request: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 7h18M3 12h18M3 17h18" />
      <circle cx="7" cy="7" r="0.6" />
      <circle cx="7" cy="12" r="0.6" />
      <circle cx="7" cy="17" r="0.6" />
    </>
  ),
  menu: (
    <>
      <path d="M6 3h9a3 3 0 0 1 3 3v15l-3-2-3 2-3-2-3 2V6a3 3 0 0 1 3-3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  pricing: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </>
  ),
  recipe: (
    <>
      <path d="M4 20h16" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M9 6.5c0-1 .8-1.5 1.5-1.5S12 5.5 12 6.5 13 8 14 8" />
      <circle cx="9" cy="12" r="0.7" />
      <circle cx="13" cy="14" r="0.7" />
      <circle cx="16" cy="11.5" r="0.7" />
    </>
  ),
  cost: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.5a3 3 0 0 0-2.5-1.2c-1.7 0-2.6.9-2.6 2 0 2.6 5.2 1.3 5.2 3.9 0 1.2-1 2-2.6 2a3 3 0 0 1-2.5-1.2" />
      <path d="M12 6v1.3M12 16.7V18" />
    </>
  ),
};

export default function ModuleIcon({
  name,
  className,
  size = 20,
}: {
  name?: string;
  className?: string;
  size?: number;
}) {
  const p = (name && paths[name]) || paths.flyer;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {p}
    </svg>
  );
}
