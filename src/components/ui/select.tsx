"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  close: () => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  variant?: "default" | "ghost";
  align?: "left" | "right";
  children: React.ReactNode;
  "aria-label"?: string;
  className?: string;
};

export function Select({
  value,
  onValueChange,
  variant = "default",
  align = "left",
  children,
  "aria-label": ariaLabel,
  className,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Derive the display label from children
  const label = React.useMemo(() => {
    let found: React.ReactNode = value;
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement<SelectItemProps>(child) &&
        child.props.value === value
      ) {
        found = child.props.children;
      }
    });
    return found;
  }, [children, value]);

  // Click-outside to close
  React.useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Keyboard: Escape to close
  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, close: () => setOpen(false) }}>
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg text-sm transition-colors",
            variant === "default" &&
              "h-10 w-full border border-input bg-card px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === "ghost" &&
              "h-9 w-auto bg-transparent px-2 font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <span>{label}</span>
          <ChevronDown
            className={cn(
              "shrink-0 transition-transform duration-150",
              variant === "default" ? "h-4 w-4 text-muted-foreground" : "h-3.5 w-3.5 text-muted-foreground",
              open && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown panel */}
        <div
          role="listbox"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            "origin-top transition-all duration-150",
            align === "right" ? "right-0" : "left-0",
            open ? "scale-y-100 opacity-100" : "pointer-events-none scale-y-95 opacity-0"
          )}
        >
          <div className="py-1">{children}</div>
        </div>
      </div>
    </SelectContext.Provider>
  );
}

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
};

export function SelectItem({ value, children }: SelectItemProps) {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("SelectItem must be inside Select");
  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        ctx.onValueChange(value);
        ctx.close();
      }}
      className={cn(
        "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-secondary"
      )}
    >
      <span>{children}</span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
