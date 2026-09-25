"use client";

/** "Save as PDF" = the browser's print dialog (Destination → Save as PDF). */
export function PrintButton({ label = "Guardar como PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost print:hidden">
      ↓ {label}
    </button>
  );
}
