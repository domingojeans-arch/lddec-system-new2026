"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: { label: string; value: string }[]
  value?: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

/**
 * COMBOBOX INDUSTRIAL LDDEC
 * Optimizado para usabilidad táctil (Tablets/Móviles) y Desktop.
 * Garantiza selección inmediata por tap sin dependencia de tecla Enter.
 */
export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Filter options based on search input (case-insensitive)
  const filteredOptions = React.useMemo(() => {
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [search, options]);

  // Manejador de selección para asegurar el cierre y la actualización del estado
  const handleItemSelect = (optionValue: string) => {
    onSelect(optionValue)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between erp-input h-11 px-4 font-bold text-left shadow-sm", 
            !value && "text-muted-foreground font-normal", 
            className
          )}
        >
          <span className="truncate">
            {value
              ? options.find((option) => option.value === value)?.label
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 rounded-[24px] shadow-premium-lg border-border bg-card z-[100]"
        align="start"
        sideOffset={4}
      >
        <Command className="w-full overflow-hidden" loop>
          <CommandInput 
            placeholder={searchPlaceholder} 
            className="h-14 text-sm border-none focus:ring-0" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CommandList className="max-h-[350px] overflow-y-auto p-2 scroll-smooth scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <CommandEmpty className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              No se encontraron resultados
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  // La selección se activa inmediatamente al hacer tap/click o presionar Enter
                  onSelect={() => handleItemSelect(option.value)}
                  // IMPORTANTE para dispositivos táctiles:
                  // Prevenimos que el foco salte al item de forma que interrumpa el evento click/select.
                  // Esto asegura que onSelect se dispare confiablemente en tablets.
                  onPointerDown={(e) => e.preventDefault()}
                  className="rounded-2xl my-1 text-[11px] font-black uppercase flex items-center gap-3 py-4 px-5 cursor-pointer aria-selected:bg-primary aria-selected:text-white transition-all duration-200 pointer-events-auto"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-300",
                      value === option.value ? "scale-110 opacity-100" : "scale-50 opacity-0"
                    )}
                  />
                  <span className="truncate flex-1 tracking-wider">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
