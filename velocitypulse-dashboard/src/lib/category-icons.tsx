import {
  Server,
  Monitor,
  Laptop,
  Router,
  Network,
  Printer,
  Camera,
  Phone,
  Wifi,
  Tv,
  Shield,
  HardDrive,
  Cloud,
  Box,
  Cpu,
  type LucideIcon,
} from 'lucide-react'

export interface CategoryIconConfig {
  id: string
  label: string
  icon: LucideIcon
  color: string // Badge/icon background color
}

// Icon configurations matching the IT Dashboard design
export const CATEGORY_ICONS: CategoryIconConfig[] = [
  { id: 'box', label: 'Box', icon: Box, color: '#6b7280' },           // Gray
  { id: 'server', label: 'Server', icon: Server, color: '#3b82f6' },  // Blue
  { id: 'network', label: 'Network', icon: Network, color: '#10b981' }, // Green
  { id: 'camera', label: 'Camera', icon: Camera, color: '#06b6d4' },  // Cyan
  { id: 'phone', label: 'Phone', icon: Phone, color: '#ec4899' },     // Pink
  { id: 'wifi', label: 'WiFi', icon: Wifi, color: '#f87171' },        // Red/Coral
  { id: 'printer', label: 'Printer', icon: Printer, color: '#6b7280' }, // Gray
  { id: 'shield', label: 'Shield', icon: Shield, color: '#f472b6' },  // Pink
  { id: 'hard-drive', label: 'Storage', icon: HardDrive, color: '#3b82f6' }, // Blue
  { id: 'cloud', label: 'Cloud', icon: Cloud, color: '#60a5fa' },     // Light Blue
  { id: 'monitor', label: 'Desktop', icon: Monitor, color: '#8b5cf6' }, // Purple
  { id: 'laptop', label: 'Laptop', icon: Laptop, color: '#a78bfa' },  // Light Purple
  { id: 'router', label: 'Router', icon: Router, color: '#f59e0b' },  // Amber
  { id: 'tv', label: 'Display', icon: Tv, color: '#14b8a6' },         // Teal
  { id: 'cpu', label: 'CPU', icon: Cpu, color: '#ef4444' },           // Red
]

// Get icon config by ID
export function getCategoryIcon(iconId: string | undefined | null): CategoryIconConfig {
  const found = CATEGORY_ICONS.find(i => i.id === iconId)
  return found || CATEGORY_ICONS[0] // Default to 'box'
}

// Render category icon in a colored square
export function CategoryIconDisplay({
  iconId,
  size = 'md',
  className = '',
}: {
  iconId: string | undefined | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = getCategoryIcon(iconId)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center ${className}`}
      style={{ backgroundColor: `${config.color}20` }}
    >
      <Icon className={iconSizes[size]} style={{ color: config.color }} />
    </div>
  )
}

// Render icon type badge
export function CategoryIconBadge({
  iconId,
  className = '',
}: {
  iconId: string | undefined | null
  className?: string
}) {
  const config = getCategoryIcon(iconId)

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${className}`}
      style={{
        color: config.color,
        borderColor: config.color,
        backgroundColor: `${config.color}10`,
      }}
    >
      {config.id}
    </span>
  )
}
