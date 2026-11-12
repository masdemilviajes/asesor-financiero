"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón grande para elegir un archivo del dispositivo. */
export function FilePicker({
  accept,
  label,
  disabled,
  onFile,
}: {
  accept: string;
  label: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permite volver a elegir el mismo archivo
          if (file) onFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full justify-center border-dashed text-base"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden />
        <span className="truncate">{label}</span>
      </Button>
    </>
  );
}
