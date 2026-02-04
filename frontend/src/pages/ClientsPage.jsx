import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";

export default function ClientsPage({
  clients,
  clientColumns,
  clientDialogOpen,
  setClientDialogOpen,
  clientForm,
  setClientForm,
  editingClientId,
  resetClientForm,
  handleClientSubmit,
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Create and update client profiles.
          </p>
        </div>
        <Button
          onClick={() => {
            resetClientForm();
            setClientDialogOpen(true);
          }}
        >
          New client
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">

          <DataTable
            columns={clientColumns}
            data={clients}
            emptyMessage="No clients yet."
            searchKey="name"
            searchPlaceholder="Search clients..."
          />
        </CardContent>
      </Card>

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClientId ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>Save core details for each client.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleClientSubmit}>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Name</label>
                <Input
                  value={clientForm.name}
                  onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
                  required
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Company</label>
                <Input
                  value={clientForm.company}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, company: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Contact name</label>
                <Input
                  value={clientForm.contact_name}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, contact_name: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Email</label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, email: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Contact email</label>
                <Input
                  type="email"
                  value={clientForm.contact_email}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, contact_email: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Phone</label>
                <Input
                  value={clientForm.phone}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, phone: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Contact phone</label>
                <Input
                  value={clientForm.contact_phone}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, contact_phone: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Website</label>
                <Input
                  value={clientForm.website}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, website: event.target.value })
                  }
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Invoice email</label>
                <Input
                  type="email"
                  value={clientForm.invoice_email}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, invoice_email: event.target.value })
                  }
                />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Address</label>
              <Textarea
                value={clientForm.address}
                onChange={(event) =>
                  setClientForm({ ...clientForm, address: event.target.value })
                }
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetClientForm}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{editingClientId ? "Update client" : "Create client"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
