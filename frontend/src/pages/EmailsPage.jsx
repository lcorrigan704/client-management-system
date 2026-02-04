import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";

export default function EmailsPage({
  emailResponse,
  emailDialogOpen,
  setEmailDialogOpen,
  emailForm,
  setEmailForm,
  handleEmailDraftSubmit,
  handleCopyEmail,
  buildMailto,
  emailEntityOptions,
  clients,
}) {
  const handleDownloadPdf = () => {
    if (!emailResponse?.pdf_base64) return;
    const byteCharacters = atob(emailResponse.pdf_base64);
    const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = emailResponse.pdf_filename || "document.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Emails</h2>
          <p className="text-sm text-muted-foreground">Generate drafts or send via SMTP.</p>
        </div>
        <Button
          onClick={() => {
            setEmailForm({ ...emailForm, entity_id: "", to_email: "", client_id: "" });
            setEmailDialogOpen(true);
          }}
        >
          New email
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Draft output</CardTitle>
          <CardDescription>Copy into your email client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailResponse ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold">Subject:</span> {emailResponse.subject}
              </p>
              <pre className="whitespace-pre-wrap rounded-md bg-muted/70 p-3 text-xs text-foreground">
                {emailResponse.body}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={handleCopyEmail}>
                  Copy email
                </Button>
                <a
                  className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  href={buildMailto()}
                >
                  Open in mail client
                </a>
                {emailResponse.pdf_base64 ? (
                  <Button type="button" variant="outline" onClick={handleDownloadPdf}>
                    Download PDF
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{emailResponse.message}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No draft generated yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compose draft</DialogTitle>
            <DialogDescription>Pick a record and generate an email.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleEmailDraftSubmit}>
            <div className={gridTwo}>
              <div className={fieldClass}>
                <label className={labelClass}>Client</label>
                <Select
                  value={emailForm.client_id || "all"}
                  onValueChange={(value) =>
                    setEmailForm({
                      ...emailForm,
                      client_id: value === "all" ? "" : value,
                      entity_id: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.company || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Entity type</label>
                <Select
                  value={emailForm.entity_type}
                  onValueChange={(value) =>
                    setEmailForm({ ...emailForm, entity_type: value, entity_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="agreement">Service agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>{emailEntityOptions.label}</label>
                <Select
                  value={emailForm.entity_id}
                  onValueChange={(value) => {
                    const selected = emailEntityOptions.items.find(
                      (item) => item.id === value
                    );
                    setEmailForm({
                      ...emailForm,
                      entity_id: value,
                      to_email: selected?.email || emailForm.to_email,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${emailEntityOptions.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {emailEntityOptions.items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>To email (optional)</label>
                <Input
                  type="email"
                  value={emailForm.to_email}
                  onChange={(event) => setEmailForm({ ...emailForm, to_email: event.target.value })}
                />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Send via SMTP</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={emailForm.send}
                    onChange={(event) =>
                      setEmailForm({ ...emailForm, send: event.target.checked })
                    }
                  />
                  Send now (requires SMTP configured)
                </label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Generate draft</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
