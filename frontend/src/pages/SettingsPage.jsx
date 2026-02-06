import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { fieldClass, labelClass } from "@/ui/formStyles";
import { useState } from "react";

export default function SettingsPage({
  settings,
  updateSettings,
  onSaveSettings,
  onSaveSmtp,
  onBackup,
  onResetData,
  onListBackups,
  onRestoreBackup,
  onRestoreUpload,
  onResetWorkspace,
}) {
  const [resetConfirm, setResetConfirm] = useState("");
  const [workspaceConfirm, setWorkspaceConfirm] = useState("");
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupDownload, setBackupDownload] = useState(true);
  const [backupStore, setBackupStore] = useState(true);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [restoreFile, setRestoreFile] = useState(null);
  const companyName = settings?.company_name || "Your Company";
  const canReset = resetConfirm.trim() === companyName.trim();
  const canResetWorkspace = workspaceConfirm.trim() === companyName.trim();
  const canRestore = restoreConfirm.trim() === companyName.trim();
  const canBackup = backupDownload || backupStore;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure prefixes, compliance dates, and SMTP.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Used in the header and email templates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Company name</label>
            <Input
              value={settings?.company_name || ""}
              onChange={(event) => updateSettings({ company_name: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Company address</label>
            <Textarea
              value={settings?.company_address || ""}
              rows={3}
              onChange={(event) => updateSettings({ company_address: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Invoice contact email</label>
            <Input
              value={settings?.company_invoice_email || ""}
              onChange={(event) => updateSettings({ company_invoice_email: event.target.value })}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSaveSettings}>Save company details</Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Document prefixes</CardTitle>
          <CardDescription>Controls the prefix used in display IDs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Invoice prefix</label>
            <Input
              value={settings?.invoice_prefix || ""}
              onChange={(event) => updateSettings({ invoice_prefix: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Quote prefix</label>
            <Input
              value={settings?.quote_prefix || ""}
              onChange={(event) => updateSettings({ quote_prefix: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Proposal prefix</label>
            <Input
              value={settings?.proposal_prefix || ""}
              onChange={(event) => updateSettings({ proposal_prefix: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Agreement prefix</label>
            <Input
              value={settings?.agreement_prefix || ""}
              onChange={(event) => updateSettings({ agreement_prefix: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Expense prefix</label>
            <Input
              value={settings?.expense_prefix || ""}
              onChange={(event) => updateSettings({ expense_prefix: event.target.value })}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSaveSettings}>Save document prefixes</Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bank details</CardTitle>
          <CardDescription>These appear on invoice emails.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Bank name</label>
            <Input
              value={settings?.bank_name || ""}
              onChange={(event) => updateSettings({ bank_name: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Account name</label>
            <Input
              value={settings?.bank_account_name || ""}
              onChange={(event) => updateSettings({ bank_account_name: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Account number</label>
            <Input
              value={settings?.bank_account_number || ""}
              onChange={(event) => updateSettings({ bank_account_number: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Sort code</label>
            <Input
              value={settings?.bank_sort_code || ""}
              onChange={(event) => updateSettings({ bank_sort_code: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>IBAN</label>
            <Input
              value={settings?.bank_iban || ""}
              onChange={(event) => updateSettings({ bank_iban: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>SWIFT/BIC</label>
            <Input
              value={settings?.bank_swift || ""}
              onChange={(event) => updateSettings({ bank_swift: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Reference</label>
            <Input
              value={settings?.bank_reference || ""}
              onChange={(event) => updateSettings({ bank_reference: event.target.value })}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSaveSettings}>Save bank details</Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Financial year</CardTitle>
          <CardDescription>Set the start and end of the financial year.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Start date</label>
            <DatePicker
              value={
                settings
                  ? new Date(2000, settings.fy_start_month - 1, settings.fy_start_day)
                  : null
              }
              onChange={(date) =>
                updateSettings({
                  fy_start_month: date ? date.getMonth() + 1 : 1,
                  fy_start_day: date ? date.getDate() : 1,
                })
              }
              placeholder="Pick start date"
              formatString="dd/MM"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>End date</label>
            <DatePicker
              value={
                settings
                  ? new Date(2000, settings.fy_end_month - 1, settings.fy_end_day)
                  : null
              }
              onChange={(date) =>
                updateSettings({
                  fy_end_month: date ? date.getMonth() + 1 : 12,
                  fy_end_day: date ? date.getDate() : 31,
                })
              }
              placeholder="Pick end date"
              formatString="dd/MM"
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Compliance dates</CardTitle>
          <CardDescription>Set yearly reminder dates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Accounts due</label>
            <DatePicker
              value={
                settings
                  ? new Date(2000, settings.accounts_due_month - 1, settings.accounts_due_day)
                  : null
              }
              onChange={(date) =>
                updateSettings({
                  accounts_due_month: date ? date.getMonth() + 1 : 10,
                  accounts_due_day: date ? date.getDate() : 31,
                })
              }
              placeholder="Pick accounts due date"
              formatString="dd/MM"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Confirmation date</label>
            <DatePicker
              value={
                settings
                  ? new Date(2000, settings.confirmation_date_month - 1, settings.confirmation_date_day)
                  : null
              }
              onChange={(date) =>
                updateSettings({
                  confirmation_date_month: date ? date.getMonth() + 1 : 1,
                  confirmation_date_day: date ? date.getDate() : 27,
                })
              }
              placeholder="Pick confirmation date"
              formatString="dd/MM"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Confirmation due</label>
            <DatePicker
              value={
                settings
                  ? new Date(2000, settings.confirmation_due_month - 1, settings.confirmation_due_day)
                  : null
              }
              onChange={(date) =>
                updateSettings({
                  confirmation_due_month: date ? date.getMonth() + 1 : 2,
                  confirmation_due_day: date ? date.getDate() : 10,
                })
              }
              placeholder="Pick confirmation due date"
              formatString="dd/MM"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSaveSettings}>Save settings</Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SMTP settings</CardTitle>
          <CardDescription>Used for sending emails directly.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>SMTP host</label>
            <Input
              value={settings?.smtp_host || ""}
              onChange={(event) => updateSettings({ smtp_host: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>SMTP port</label>
            <Input
              type="number"
              value={settings?.smtp_port || ""}
              onChange={(event) => updateSettings({ smtp_port: Number(event.target.value) })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>SMTP username</label>
            <Input
              value={settings?.smtp_username || ""}
              onChange={(event) => updateSettings({ smtp_username: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>SMTP password</label>
            <Input
              type="password"
              value={settings?.smtp_password || ""}
              onChange={(event) => updateSettings({ smtp_password: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>From email</label>
            <Input
              type="email"
              value={settings?.smtp_from || ""}
              onChange={(event) => updateSettings({ smtp_from: event.target.value })}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Use TLS</label>
            <Select
              value={settings?.smtp_use_tls ? "true" : "false"}
              onValueChange={(value) => updateSettings({ smtp_use_tls: value === "true" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSaveSmtp}>Save SMTP settings</Button>
        </CardFooter>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Actions that affect data integrity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-foreground">Download backup</p>
                <p className="text-sm text-muted-foreground">
                  Creates a tar.gz of the database and uploads.
                </p>
              </div>
            <Dialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Create backup</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create backup</DialogTitle>
                  <DialogDescription>
                    Choose whether to download the backup now and/or store it on the server for later restore.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">Download now</p>
                      <p className="text-sm text-muted-foreground">
                        Exports a tar.gz to your device.
                      </p>
                    </div>
                    <Switch checked={backupDownload} onCheckedChange={setBackupDownload} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">Store on server</p>
                      <p className="text-sm text-muted-foreground">
                        Saves a copy in the server backups folder.
                      </p>
                    </div>
                    <Switch checked={backupStore} onCheckedChange={setBackupStore} />
                  </div>
                  {!canBackup && (
                    <p className="text-sm text-destructive">
                      Select at least one option.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBackupDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!canBackup) return;
                      onBackup({ download: backupDownload, store: backupStore });
                      setBackupDialogOpen(false);
                    }}
                    disabled={!canBackup}
                  >
                    Run backup
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">Restore backup</p>
              <p className="text-sm text-muted-foreground">
                Restore from a server backup or upload a tar.gz file.
              </p>
            </div>
            <Dialog
              open={restoreDialogOpen}
              onOpenChange={(open) => {
                setRestoreDialogOpen(open);
                if (open && onListBackups) {
                  onListBackups().then((list) => {
                    const items = list?.backups || [];
                    setBackups(items);
                    setSelectedBackup(items[0] || "");
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Restore backup</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restore backup</DialogTitle>
                  <DialogDescription>
                    Restoring will replace the current business data and uploads. To confirm, type{" "}
                    <strong>{companyName}</strong> below. The app will reload after completion.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      value={restoreConfirm}
                      onChange={(event) => setRestoreConfirm(event.target.value)}
                      placeholder={companyName}
                    />
                    <p className="text-xs text-muted-foreground">
                      The company name must match exactly.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Restore from server</p>
                    <Select value={selectedBackup} onValueChange={setSelectedBackup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select backup file" />
                      </SelectTrigger>
                      <SelectContent>
                        {backups.length === 0 && (
                          <SelectItem value="none" disabled>
                            No backups found
                          </SelectItem>
                        )}
                        {backups.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!canRestore || !selectedBackup || selectedBackup === "none") return;
                        onRestoreBackup(selectedBackup);
                        setRestoreDialogOpen(false);
                      }}
                      disabled={!canRestore || !selectedBackup || selectedBackup === "none"}
                    >
                      Restore selected
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Restore from upload</p>
                    <Input
                      type="file"
                      accept=".tar.gz"
                      onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!canRestore || !restoreFile) return;
                        onRestoreUpload(restoreFile);
                        setRestoreDialogOpen(false);
                      }}
                      disabled={!canRestore || !restoreFile}
                    >
                      Restore uploaded
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">Reset business data</p>
              <p className="text-sm text-muted-foreground">
                Deletes clients, invoices, quotes, agreements, proposals, expenses, and uploads. Users and settings remain.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset data</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all business data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. It will permanently delete all business records and uploads.
                    To confirm, type <strong>{companyName}</strong> below.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Input
                    value={resetConfirm}
                    onChange={(event) => setResetConfirm(event.target.value)}
                    placeholder={companyName}
                  />
                  <p className="text-xs text-muted-foreground">
                    The company name must match exactly.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onResetData} disabled={!canReset}>
                    Yes, reset data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">Reset workspace</p>
              <p className="text-sm text-muted-foreground">
                Deletes all business data, settings, and users. You will need to run the setup wizard again.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset workspace</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the entire workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. It will remove all business data, settings, and user accounts.
                    To confirm, type <strong>{companyName}</strong> below.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Input
                    value={workspaceConfirm}
                    onChange={(event) => setWorkspaceConfirm(event.target.value)}
                    placeholder={companyName}
                  />
                  <p className="text-xs text-muted-foreground">
                    The company name must match exactly.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onResetWorkspace} disabled={!canResetWorkspace}>
                    Yes, reset workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
