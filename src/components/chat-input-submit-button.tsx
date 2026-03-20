'use client';

interface SubmitButtonProps {
  readonly hasContent: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

export function SubmitButton({ hasContent, disabled, onClick }: SubmitButtonProps) {
  const fill = hasContent ? '#006AFE' : '#0D0E10';
  const opacity = hasContent ? 1 : 0.15;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex cursor-pointer items-center justify-center transition-opacity disabled:cursor-default disabled:opacity-40"
      style={{ opacity }}
    >
      <svg width="32" height="32" viewBox="0 0 105 105" fill="none">
        <rect width="105" height="105" rx="25" fill={fill} />
        <path
          d="M43.7648 46.2035L29.7973 61.0578M29.7973 61.0578L43.7648 75.9121M29.7973 61.0578H63.3193C66.2828 61.0578 69.1249 59.8058 71.2205 57.5773C73.316 55.3487 74.4932 52.3261 74.4932 49.1744V28.3784"
          stroke="white"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
