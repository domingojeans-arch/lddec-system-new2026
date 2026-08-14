"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  month: externalMonth,
  onMonthChange: externalOnMonthChange,
  ...props
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState<Date>(
    externalMonth || props.defaultMonth || new Date()
  );
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (externalMonth) {
      setInternalMonth(externalMonth);
    }
  }, [externalMonth]);

  const currentMonth = externalMonth || internalMonth;

  const handleMonthChange = (newMonth: Date) => {
    setInternalMonth(newMonth);
    externalOnMonthChange?.(newMonth);
  };

  const handlePrevMonth = () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    handleMonthChange(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    handleMonthChange(next);
  };

  const selectedYear = currentMonth.getFullYear();
  const selectedMonthIdx = currentMonth.getMonth();

  const handleSelectMonth = (mIdx: number) => {
    const updated = new Date(selectedYear, mIdx, 1);
    handleMonthChange(updated);
    setIsPickerOpen(false);
  };

  const handleSelectYear = (year: number) => {
    const updated = new Date(year, selectedMonthIdx, 1);
    handleMonthChange(updated);
  };

  const currentYear = new Date().getFullYear();
  const years = React.useMemo(() => {
    const list = [];
    for (let y = currentYear - 15; y <= currentYear + 15; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <div className={cn("p-4 bg-white dark:bg-zinc-950 w-[310px] rounded-2xl shadow-md border border-zinc-200 dark:border-zinc-800 font-sans relative", className)}>
      {/* CABECERA ÚNICA: [ ← ] MARZO 2026 [ → ] */}
      <div className="relative flex items-center justify-center h-10 w-full px-10 mb-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Mes anterior"
          className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center absolute left-0 top-1 text-foreground opacity-70 hover:opacity-100 transition-all z-10 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className={cn(
            "font-bold text-sm uppercase tracking-tight px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-foreground",
            isPickerOpen
              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <span>{MONTHS_ES[selectedMonthIdx]} {selectedYear}</span>
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Mes siguiente"
          className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center absolute right-0 top-1 text-foreground opacity-70 hover:opacity-100 transition-all z-10 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* SELECCIÓN RÁPIDA AL HACER CLIC EN EL TÍTULO */}
      {isPickerOpen ? (
        <div className="space-y-3 py-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seleccionar Año:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleSelectYear(Number(e.target.value))}
              className="bg-muted/40 font-bold text-xs text-foreground border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-background text-foreground">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {MONTHS_ES.map((mName, idx) => {
              const isSelected = idx === selectedMonthIdx;
              return (
                <button
                  key={mName}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-medium uppercase tracking-tight transition-all flex items-center justify-center cursor-pointer",
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : "bg-muted/20 hover:bg-muted text-foreground"
                  )}
                >
                  {mName.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsPickerOpen(false)}
            className="w-full text-[11px] font-semibold text-muted-foreground hover:text-foreground text-center pt-1 underline cursor-pointer"
          >
            Cerrar selector
          </button>
        </div>
      ) : (
        /* VISTA PRINCIPAL: DÍAS DEL MES (SIN CABECERA REPETIDA) */
        <DayPicker
          month={currentMonth}
          onMonthChange={handleMonthChange}
          locale={es}
          showOutsideDays={showOutsideDays}
          className="p-0 border-none shadow-none font-sans"
          formatters={{
            formatWeekdayName: (date) => {
              const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
              return days[date.getDay()];
            }
          }}
          classNames={{
            months: "w-full",
            month: "space-y-3 w-full",
            caption: "hidden",
            month_caption: "hidden",
            caption_label: "hidden",
            nav: "hidden",
            table: "w-full border-collapse space-y-1",
            month_grid: "w-full border-collapse space-y-1",
            head_row: "flex w-full justify-between",
            weekdays: "flex w-full justify-between",
            head_cell:
              "text-muted-foreground w-9 h-9 font-medium text-[0.8rem] flex items-center justify-center",
            weekday:
              "text-muted-foreground w-9 h-9 font-medium text-[0.8rem] flex items-center justify-center",
            row: "flex w-full mt-1 justify-between",
            week: "flex w-full mt-1 justify-between",
            cell: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-medium text-sm aria-selected:opacity-100 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            ),
            day_button: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-medium text-sm aria-selected:opacity-100 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            ),
            day_range_end: "day-range-end",
            range_end: "day-range-end",
            day_selected:
              "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white dark:bg-blue-600 dark:text-white shadow-sm font-semibold",
            selected:
              "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white dark:bg-blue-600 dark:text-white shadow-sm font-semibold",
            day_today: "bg-accent text-accent-foreground font-bold border border-blue-500/30",
            today: "bg-accent text-accent-foreground font-bold border border-blue-500/30",
            day_outside:
              "day-outside text-muted-foreground opacity-30 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            outside:
              "day-outside text-muted-foreground opacity-30 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            disabled: "text-muted-foreground opacity-50",
            day_range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            hidden: "invisible",
            ...classNames,
          }}
          {...props}
        />
      )}
    </div>
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
