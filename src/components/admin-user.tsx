"use client"

import { createContext, useContext } from "react"

export type AdminUser = { name: string; email: string }

const AdminUserContext = createContext<AdminUser | null>(null)

export function AdminUserProvider({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>
}

export function useAdminUser() {
  return useContext(AdminUserContext)
}
