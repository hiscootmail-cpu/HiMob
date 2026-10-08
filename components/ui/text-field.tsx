import * as React from "react";
import { Label } from "radix-ui";

import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-line bg-hs-white px-4 text-base text-hs-black transition-colors outline-none placeholder:text-muted",
        "hover:border-hs-black/30 focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25",
        "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted",
        "aria-invalid:border-danger aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

type TextFieldProps = React.ComponentProps<"input"> & {
  label: string;
  /** Dica curta abaixo do campo. */
  hint?: string;
  /** Mensagem de erro. Quando existe, substitui a dica. */
  error?: string;
};

/** Campo de texto completo: rótulo, campo, dica e mensagem de erro. */
function TextField({ id, label, hint, error, className, ...props }: TextFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label.Root htmlFor={inputId} className="text-sm font-medium text-hs-black">
        {label}
      </Label.Root>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...props}
      />
      {message ? (
        <p
          id={messageId}
          className={cn("text-sm", error ? "text-danger" : "text-muted")}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export { Input, TextField };
