"use client";

import * as React from "react";
import { Label } from "radix-ui";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  label: string;
  hint?: string;
  error?: string;
  showLabel: string;
  hideLabel: string;
  capsLockWarning: string;
};

/** Campo de senha com botão de mostrar/esconder e aviso de Caps Lock ligado. */
function PasswordField({
  id,
  label,
  hint,
  error,
  showLabel,
  hideLabel,
  capsLockWarning,
  className,
  onKeyUp,
  onBlur,
  ...props
}: PasswordFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const capsId = `${inputId}-caps`;
  const [visible, setVisible] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label.Root htmlFor={inputId} className="text-sm font-medium text-hs-black">
        {label}
      </Label.Root>
      <div className="relative">
        <Input
          id={inputId}
          type={visible ? "text" : "password"}
          className="pr-12"
          aria-invalid={error ? true : undefined}
          aria-describedby={[message ? messageId : null, capsLock ? capsId : null].filter(Boolean).join(" ") || undefined}
          onKeyUp={(event) => {
            setCapsLock(event.getModifierState("CapsLock"));
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={inputId}
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:bg-surface hover:text-hs-black focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {capsLock ? (
        <p id={capsId} className="text-sm font-medium text-on-pink">
          {capsLockWarning}
        </p>
      ) : null}
      {message ? (
        <p
          id={messageId}
          className={cn("text-sm", error ? "text-error" : "text-muted")}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export { PasswordField };
