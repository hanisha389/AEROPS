import * as React from "react"
import { cn } from "@/lib/utils"

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[#111827]/85 border border-white/10 rounded-xl shadow-lg backdrop-blur-sm magic-hover magic-hover--glow",
          "transition-all duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Panel.displayName = "Panel"

export { Panel }
