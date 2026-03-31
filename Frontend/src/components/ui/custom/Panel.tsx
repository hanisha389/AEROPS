import * as React from "react"
import { cn } from "@/lib/utils"

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  label?: string;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, label, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "mil-panel",
          className
        )}
        {...props}
      >
        {label && (
          <div className="mil-panel-header">
            <span className="mil-panel-label">{label}</span>
          </div>
        )}
        {children}
      </div>
    )
  }
)
Panel.displayName = "Panel"

export { Panel }
