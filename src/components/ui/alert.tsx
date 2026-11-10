import type { ComponentProps } from "react";

// Local shadcn-style alert primitives; preserve the application's surface tokens.
export function Alert({ className = "", ...props }: ComponentProps<"div">) {
  return <div role="alert" className={`app-alert ${className}`} {...props} />;
}
export function AlertTitle(props: ComponentProps<"h5">) {
  return <h5 className="font-semibold" {...props} />;
}
export function AlertDescription(props: ComponentProps<"div">) {
  return <div className="text-sm" {...props} />;
}
