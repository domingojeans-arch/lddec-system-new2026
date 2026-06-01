"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface ComboboxProps {
  options: { label: string; value: string }[]
  value?: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Seleccionar...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync value from props
  React.useEffect(() => {
    if (value && !open) {
      setSearch(options.find((option) => option.value === value)?.label || "");
    }
  }, [value, options, open]);

  const filteredOptions = React.useMemo(() => {
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [search, options]);

  const handleSelect = (val: string, label: string) => {
    setSearch(label);
    onSelect(val);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setSearch(newVal);
    if (!open) setOpen(true);
    if (value && newVal !== options.find(o => o.value === value)?.label) {
      onSelect(""); 
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          value={search}
          onChange={handleInputChange}
          onClick={() => {
            if (value) {
              setSearch("");
              onSelect("");
            }
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          placeholder={placeholder}
          className={cn("w-full erp-input h-11 px-4 font-bold text-left shadow-sm pr-10", className)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </div>
      </div>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-[100] max-h-[350px] overflow-y-auto rounded-[24px] shadow-premium-lg border border-border bg-card p-2 scroll-smooth scrollbar-thin scrollbar-thumb-muted-foreground/20">
          {filteredOptions.length === 0 ? (
            <div className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              No se encontraron resultados
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value, option.label)}
                className={cn(
                  "rounded-2xl my-1 text-[11px] font-black uppercase flex items-center gap-3 py-4 px-5 cursor-pointer transition-all duration-200 pointer-events-auto",
                  value === option.value ? "bg-primary text-white" : "hover:bg-muted/50 text-foreground"
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-300",
                    value === option.value ? "scale-110 opacity-100" : "scale-50 opacity-0"
                  )}
                />
                <span className="truncate flex-1 tracking-wider">{option.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
