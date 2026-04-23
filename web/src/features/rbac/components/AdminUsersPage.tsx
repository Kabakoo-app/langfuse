import { DataTable } from "@/src/components/table/data-table";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import { Badge } from "@/src/components/ui/badge";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { api } from "@/src/utils/api";
import type { RouterOutput } from "@/src/utils/types";
import { Trash, UserX } from "lucide-react";
import { useSession } from "next-auth/react";

type UserFromQuery =
  RouterOutput["members"]["allUsersAdmin"]["users"][number];

type AdminUserRow = {
  user: { image: string | null; name: string | null };
  email: string | null;
  createdAt: Date;
  organizationMemberships: UserFromQuery["organizationMemberships"];
  meta: { userId: string; orgMembershipId: string | undefined };
};

export function AdminUsersPage({ orgId }: { orgId: string }) {
  const session = useSession();
  const utils = api.useUtils();

  const usersQuery = api.members.allUsersAdmin.useQuery({ orgId });

  const mutDeleteMembership = api.members.deleteMembership.useMutation({
    onSuccess: () => {
      void utils.members.invalidate();
      showSuccessToast({
        title: "Removed",
        description: "User removed from organization.",
        duration: 2000,
      });
    },
  });

  const mutDeleteUser = api.members.deleteUser.useMutation({
    onSuccess: () => {
      void utils.members.invalidate();
      showSuccessToast({
        title: "Deleted",
        description: "User account permanently deleted.",
        duration: 2000,
      });
    },
  });

  const columns: LangfuseColumnDef<AdminUserRow>[] = [
    {
      accessorKey: "user",
      id: "user",
      header: "Name",
      cell: ({ row }) => {
        const { name, image } = row.getValue("user") as AdminUserRow["user"];
        return (
          <div className="flex items-center space-x-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={image ?? undefined} alt={name ?? "User"} />
              <AvatarFallback>
                {name
                  ? name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                  : null}
              </AvatarFallback>
            </Avatar>
            <span>{name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      id: "email",
      header: "Email",
    },
    {
      accessorKey: "organizationMemberships",
      id: "organizationMemberships",
      header: "Org Memberships",
      cell: ({ row }) => {
        const memberships = row.getValue(
          "organizationMemberships",
        ) as AdminUserRow["organizationMemberships"];
        if (memberships.length === 0)
          return <span className="text-muted-foreground">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {memberships.map((m) => (
              <Badge key={m.id} variant="outline" className="text-xs">
                {m.orgName} ({m.role})
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Joined",
      cell: ({ row }) => {
        const value = row.getValue("createdAt") as Date;
        return value ? new Date(value).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "meta",
      id: "meta",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        const { userId, orgMembershipId } = row.getValue(
          "meta",
        ) as AdminUserRow["meta"];
        const email = row.getValue("email") as string | null;
        const isSelf = userId === session.data?.user?.id;

        if (isSelf) return null;

        return (
          <div className="flex items-center space-x-2">
            {orgMembershipId && (
              <button
                title="Remove from organization"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to remove this user from the organization?",
                    )
                  ) {
                    mutDeleteMembership.mutate({ orgId, orgMembershipId });
                  }
                }}
              >
                <Trash size={14} />
              </button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  title="Permanently delete user account"
                  className="text-destructive hover:text-destructive/80"
                >
                  <UserX size={14} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete user account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete{" "}
                    <strong>{email ?? userId}</strong>&apos;s account and revoke
                    all access. Their sessions, API keys, and all associated
                    data will be removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => mutDeleteUser.mutate({ orgId, userId })}
                  >
                    Delete user
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ];

  const convertToRow = (u: UserFromQuery): AdminUserRow => ({
    user: { image: u.image, name: u.name },
    email: u.email,
    createdAt: u.createdAt,
    organizationMemberships: u.organizationMemberships,
    meta: {
      userId: u.id,
      orgMembershipId: u.organizationMemberships.find((m) => m.orgId === orgId)
        ?.id,
    },
  });

  return (
    <DataTable
      tableName="adminUsers"
      columns={columns}
      data={
        usersQuery.isPending
          ? { isLoading: true, isError: false }
          : usersQuery.isError
            ? {
                isLoading: false,
                isError: true,
                error: usersQuery.error.message,
              }
            : {
                isLoading: false,
                isError: false,
                data: (usersQuery.data?.users ?? []).map(convertToRow),
              }
      }
    />
  );
}
