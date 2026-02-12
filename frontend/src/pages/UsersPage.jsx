import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fieldClass, labelClass } from "@/ui/formStyles";

export default function UsersPage({
  users,
  userColumns,
  userDialogOpen,
  setUserDialogOpen,
  userForm,
  setUserForm,
  editingUserId,
  resetUserForm,
  handleUserSubmit,
  onBulkDelete,
}) {
  const [showBankDetails, setShowBankDetails] = useState(false);

  useEffect(() => {
    const hasBankData =
      Boolean(userForm.bank_account_name) ||
      Boolean(userForm.bank_account_number) ||
      Boolean(userForm.bank_sort_code);
    setShowBankDetails(hasBankData);
  }, [userForm.bank_account_name, userForm.bank_account_number, userForm.bank_sort_code]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage access for your workspace.
          </p>
        </div>
        <Button
          onClick={() => {
            resetUserForm();
            setUserDialogOpen(true);
          }}
        >
          New user
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={userColumns}
            data={users}
            emptyMessage="No users yet."
            searchKey="email"
            searchPlaceholder="Search users..."
            enableRowSelection
            bulkActions={[
              {
                label: "Delete selected",
                variant: "destructive",
                onClick: (rows) => onBulkDelete?.(rows),
                confirm: {
                  title: "Delete selected users?",
                  description:
                    "This action cannot be undone. The selected users will be permanently removed.",
                  confirmLabel: "Delete users",
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUserId ? "Edit user" : "New user"}</DialogTitle>
            <DialogDescription>Assign roles and manage access.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUserSubmit}>
            <div className="grid gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Email</label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Role</label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) => setUserForm({ ...userForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Status</label>
                <Select
                  value={userForm.is_active ? "true" : "false"}
                  onValueChange={(value) =>
                    setUserForm({ ...userForm, is_active: value === "true" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>
                  {editingUserId ? "Reset password" : "Password"}
                </label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(event) =>
                    setUserForm({ ...userForm, password: event.target.value })
                  }
                  placeholder={editingUserId ? "Leave blank to keep" : "Enter password"}
                  required={!editingUserId}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 9 characters, 1 uppercase, 1 special character.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Add bank details</p>
                  <p className="text-xs text-muted-foreground">
                    Include account details for expense payouts.
                  </p>
                </div>
                <Switch
                  checked={showBankDetails}
                  onCheckedChange={(checked) => {
                    setShowBankDetails(checked);
                    if (!checked) {
                      setUserForm({
                        ...userForm,
                        bank_account_name: "",
                        bank_account_number: "",
                        bank_sort_code: "",
                      });
                    }
                  }}
                />
              </div>
              {showBankDetails ? (
                <>
                  <div className={fieldClass}>
                    <label className={labelClass}>Account name</label>
                    <Input
                      value={userForm.bank_account_name}
                      onChange={(event) =>
                        setUserForm({ ...userForm, bank_account_name: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Account number</label>
                    <Input
                      value={userForm.bank_account_number}
                      onChange={(event) =>
                        setUserForm({ ...userForm, bank_account_number: event.target.value })
                      }
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Sort code</label>
                    <Input
                      value={userForm.bank_sort_code}
                      onChange={(event) =>
                        setUserForm({ ...userForm, bank_sort_code: event.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save user</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
