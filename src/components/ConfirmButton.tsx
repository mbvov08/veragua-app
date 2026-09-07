"use client";

import { useTransition } from "react";

export default function ConfirmButton({
  action,
  confirmMessage,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className={className}
      onClick={() => {
        if (confirm(confirmMessage)) {
          startTransition(action);
        }
      }}
    >
      {children}
    </button>
  );
}
