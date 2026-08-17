import { DataTable } from "@/src/components/table/data-table";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
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
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import useColumnOrder from "@/src/features/column-visibility/hooks/useColumnOrder";
import { MembershipInvitesPage } from "@/src/features/rbac/components/MembershipInvitesPage";
import { CreateProjectMemberButton } from "@/src/features/rbac/components/CreateProjectMemberButton";
import { RoleSelectItem } from "@/src/features/rbac/components/RoleSelectItem";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { api } from "@/src/utils/api";
import type { RouterOutput } from "@/src/utils/types";
import { Role } from "@langfuse/shared";
import { Trash, UserX } from "lucide-react";
import { useSession } from "next-auth/react";

type UserFromQuery =
  RouterOutput["members"]["allUsersAdmin"]["users"][number];

type UserRow = {
  user: { image: string | null; name: string | null };
  email: string | null;
  createdAt: Date;
  orgRole: Role | undefined;
  meta: {
    userId: string;
    orgMembershipId: string | undefined;
  };
};

export function MembersManagementPage({ orgId }: { orgId: string }) {
  const session = useSession();
  const utils = api.useUtils();

  const usersQuery = api.members.allUsersAdmin.useQuery({ orgId });

  const mutUpdateRole = api.members.updateOrgMembership.useMutation({
    onSuccess: (data) => {
      void utils.members.invalidate();
      if (data.userId === session.data?.user?.id) void session.update();
      showSuccessToast({
        title: "Saved",
        description: "Role updated.",
        duration: 2000,
      });
    },
  });

  const mutRemoveFromOrg = api.members.deleteMembership.useMutation({
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

  const columns: LangfuseColumnDef<UserRow>[] = [
    {
      accessorKey: "user",
      id: "user",
      header: "Name",
      cell: ({ row }) => {
        const { name, image } = row.getValue("user") as UserRow["user"];
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
      accessorKey: "orgRole",
      id: "orgRole",
      header: "Role",
      cell: ({ row }) => {
        const orgRole = row.getValue("orgRole") as UserRow["orgRole"];
        const { orgMembershipId, userId } = row.getValue(
          "meta",
        ) as UserRow["meta"];
        const isSelf = userId === session.data?.user?.id;

        if (!orgMembershipId || !orgRole)
          return <span className="text-muted-foreground">—</span>;

        return (
          <Select
            disabled={isSelf || mutUpdateRole.isPending}
            value={orgRole}
            onValueChange={(value) => {
              if (
                userId !== session.data?.user?.id ||
                confirm(
                  "Are you sure you want to change your own organization role?",
                )
              ) {
                mutUpdateRole.mutate({
                  orgId,
                  orgMembershipId,
                  role: value as Role,
                });
              }
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Role).map((role) => (
                <RoleSelectItem role={role} key={role} />
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Joined",
      enableHiding: true,
      defaultHidden: true,
      cell: ({ row }) => {
        const value = row.getValue("createdAt") as Date;
        return value ? new Date(value).toLocaleDateString() : "—";
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
        ) as UserRow["meta"];
        const email = row.getValue("email") as string | null;
        const isSelf = userId === session.data?.user?.id;

        if (isSelf) return null;

        return (
          <div className="flex items-center space-x-2">
            {orgMembershipId && (
              <button
                title="Remove from organization"
                onClick={() => {
                  if (confirm("Remove this user from the organization?")) {
                    mutRemoveFromOrg.mutate({ orgId, orgMembershipId });
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

  const [columnVisibility, setColumnVisibility] =
    useColumnVisibility<UserRow>("membersManagementVisibility", columns);

  const [columnOrder, setColumnOrder] = useColumnOrder<UserRow>(
    "membersManagementOrder",
    columns,
  );

  const convertToRow = (u: UserFromQuery): UserRow => {
    const membership = u.organizationMemberships.find(
      (m: UserFromQuery["organizationMemberships"][number]) =>
        m.orgId === orgId,
    );
    return {
      user: { image: u.image, name: u.name },
      email: u.email,
      createdAt: u.createdAt,
      orgRole: membership?.role,
      meta: {
        userId: u.id,
        orgMembershipId: membership?.id,
      },
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <DataTableToolbar
          columns={columns}
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
          columnOrder={columnOrder}
          setColumnOrder={setColumnOrder}
          actionButtons={<CreateProjectMemberButton orgId={orgId} />}
        />
        <DataTable
          tableName="membersManagement"
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
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          cellPadding="comfortable"
        />
      </div>
      <MembershipInvitesPage orgId={orgId} />
    </div>
  );
}
