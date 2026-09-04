import { twMerge } from 'tailwind-merge'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  shadow?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  xs: 'min-h-8 px-6',
  sm: 'min-h-12 px-8',
  md: 'min-h-16 px-12',
  lg: 'min-h-24 px-18',
}

export const Button = ({ size ="md", children, className, shadow, ...props }: ButtonProps) => {
  return (
    <button
      className={twMerge(`cursor-pointer transition-all ease-in-out inline-flex items-center bg-omega-cyan text-omega-ink-black font-display uppercase`, sizeClasses[size], shadow ? 'shadow-[8px_8px_0_#FF4D8D] hover:translate-[4px_4px] hover:shadow-[4px_4px_0_#FF4D8D]' : 'hover:text-white hover:bg-omega-magenta', className)}
      {...props}
    >
      {children}
    </button>
  )
}
