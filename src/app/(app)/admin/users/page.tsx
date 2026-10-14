"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { UserProfile } from "@/types/auth";

type UserRow = UserProfile & {
  role_label?: string;
  office_label?: string;
  department_label?: string;
};
import { LAUNCHER_USERS_URL } from "@/lib/launcher-kit/urls";


export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  return (
    <>
      <AppHeader title="Users" />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Managed in the BBD Launcher — users, roles, offices and app access
            are edited there and sync to PSB within a minute. To see PSB as a
            user, use &ldquo;View as&rdquo; in the launcher.
          </p>
          <Button asChild variant="outline">
            <a href={LAUNCHER_USERS_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Launcher Users
            </a>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={user.is_active === false ? "opacity-50" : undefined}>
                <TableCell className="font-medium">{user.name || "—"}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.office ? (
                    <Badge variant="outline">{user.office_label || user.office}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.department ? (
                    <Badge variant="outline">{user.department_label || user.department}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{user.role_label || user.role}</Badge>
                    {user.is_it && <Badge>IT</Badge>}
                    {user.is_active === false && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </main>
    </>
  );
}
