import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* Buttons follow design.md: near-black primary, white hairline secondary, and
   a 12px corner. Radius is hierarchical, so only the small sizes step down to
   10px. The pill variant belongs to the pricing sub-system alone. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-border disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink-active",
        outline:
          "border-hairline bg-canvas text-ink hover:bg-soft hover:border-line-strong",
        secondary: "bg-soft text-ink border-hairline hover:bg-strong",
        ghost: "text-body hover:bg-soft hover:text-ink",
        destructive: "bg-coral text-white /90",
        success: "bg-success text-white /90",
        link: "text-link underline-offset-4 hover:underline hover:text-link-active",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-6 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 px-6 text-base",
        pill: "h-11 rounded-full px-6 text-base",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
