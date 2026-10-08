"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Aviso rápido que aparece no canto da tela. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-line !bg-hs-white !text-hs-black !font-sans !shadow-lg",
          title: "!text-hs-black !font-semibold",
          description: "!text-muted",
          success: "[&_[data-icon]]:!text-on-green",
          error: "[&_[data-icon]]:!text-error",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
