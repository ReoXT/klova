import { FormField } from "@/components/ui/FormField";

export interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

// Single masked 4-digit PIN field. type="password" masks the digits;
// inputMode="numeric" gives mobile browsers a numeric keypad; autoComplete
// is deliberately "off" (not e.g. "one-time-code") so no browser/password
// manager offers to save or autofill a withdrawal PIN.
export function PinInput({ label, value, onChange, error, autoFocus }: PinInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value.replace(/\D/g, "").slice(0, 4));
  }

  return (
    <FormField
      label={label}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={handleChange}
      error={error}
      maxLength={4}
      placeholder="••••"
      className="font-mono tracking-[0.5em] text-center"
      autoFocus={autoFocus}
    />
  );
}
