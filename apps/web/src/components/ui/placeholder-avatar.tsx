import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { AiOutlineUser } from "react-icons/ai";

interface PlaceholderAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
  lg: "h-16 w-16",
};

export function PlaceholderAvatar({
  src,
  alt = "User",
  fallback = "U",
  className = "",
  size = "md",
}: PlaceholderAvatarProps) {
  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage src={src} alt={alt} className="rounded-full object-cover" />
      <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
        <AiOutlineUser className="h-1/2 w-1/2" />
      </AvatarFallback>
    </Avatar>
  );
}
