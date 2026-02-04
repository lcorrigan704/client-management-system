import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const Highlight = ({ children, className, containerClassName }) => {
  return (
    <div className={cn("transition-colors duration-300", containerClassName, className)}>
      {children}
    </div>
  );
};

const HighlightItem = ({ children, className, activeClassName, ...props }) => {
  const classes = cn("transition-colors duration-300", activeClassName, className);
  if (React.isValidElement(children)) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export { Highlight, HighlightItem };
