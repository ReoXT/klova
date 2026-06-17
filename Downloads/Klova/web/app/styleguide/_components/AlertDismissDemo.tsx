"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";

export function AlertDismissDemo() {
  const [visible, setVisible] = useState(true);

  return (
    <div className="min-h-[3.5rem] flex items-center">
      {visible ? (
        <Alert
          variant="success"
          onDismiss={() => setVisible(false)}
          className="w-full"
        >
          Booking confirmed! <strong>Adaeze</strong> arrives Dec 18 between 9:00–9:30 AM. Check your phone for the SMS.
        </Alert>
      ) : (
        <div className="flex items-center gap-3 text-sm text-base-content/50 w-full">
          <span>Alert dismissed.</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setVisible(true)}
          >
            Show again
          </button>
        </div>
      )}
    </div>
  );
}
