"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white dark:bg-zinc-950 w-fit rounded-2xl shadow-md border dark:border-zinc-800 font-sans", className)}
      formatters={{
        formatWeekdayName: (date) => {
          const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
          return days[date.getDay()];
        }
      }}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 pb-1 relative items-center",
        month_caption: "flex justify-center pt-1 pb-1 relative items-center",
        caption_label: "text-sm font-semibold capitalize",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-lg absolute"
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-lg absolute left-1"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-lg absolute right-1"
        ),
        nav_button_previous: "left-1",
        nav_button_next: "right-1",
        table: "w-full border-collapse space-y-1",
        month_grid: "w-full border-collapse space-y-1",
        head_row: "flex",
        weekdays: "flex",
        head_cell:
          "text-muted-foreground w-9 h-9 font-medium text-[0.8rem] flex items-center justify-center",
        weekday:
          "text-muted-foreground w-9 h-9 font-medium text-[0.8rem] flex items-center justify-center",
        row: "flex w-full mt-2",
        week: "flex w-full mt-2",
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
          "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white dark:bg-blue-600 dark:text-white shadow-sm",
        selected:
          "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white dark:bg-blue-600 dark:text-white shadow-sm",
        day_today: "bg-accent text-accent-foreground",
        today: "bg-accent text-accent-foreground",
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
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
