import * as React from "react"
import { cn } from "@app/lib/utils"

interface CheckboxProps extends React.ComponentProps<"input"> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = React.useId()
    const checkboxId = id || generatedId

    if (label) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            className={cn(
              "h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            id={checkboxId}
            {...props}
          />
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {label}
          </label>
        </div>
      )
    }

    return (
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        id={id}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }