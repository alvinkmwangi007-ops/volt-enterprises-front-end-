import {
  Car,
  FileText,
  LayoutDashboard,
  LogIn,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from 'lucide-react'

// One entry per navigation label; keeps icon mapping out of the render code.
const NAV_ICONS = {
  Dashboard: LayoutDashboard,
  'Cashflow Overview': LayoutDashboard,
  Inventory: Car,
  'My Vehicles': Car,
  Service: Wrench,
  Shop: ShoppingCart,
  Cart: ShoppingCart,
  Customers: Users,
  Documents: FileText,
  'Buyer Login': LogIn,
  'Seller Login': LogIn,
  Settings,
}

export function iconForLabel(label) {
  return NAV_ICONS[label] || LayoutDashboard
}
