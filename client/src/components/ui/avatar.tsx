import * as React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.ComponentProps<'div'> {
  className?: string
}
function Avatar({ className, ...props }: AvatarProps) {
  return (
    <div
      data-slot="avatar"
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

interface AvatarImageProps extends React.ComponentProps<'img'> {
  className?: string
}
function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <img
      data-slot="avatar-image"
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends React.ComponentProps<'div'> {
  className?: string
}
function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        'bg-muted flex h-full w-full items-center justify-center rounded-full text-sm font-medium',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }