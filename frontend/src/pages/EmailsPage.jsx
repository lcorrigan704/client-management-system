import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gridTwo, fieldClass, labelClass } from "@/ui/formStyles";
import { API_URL } from "@/api/client";

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
  const selectedEntity = emailEntityOptions.items.find((item) => item.id === emailForm.entity_id);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const downloadBlob = async (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    await wait(150);
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!emailResponse?.pdf_base64) return;
    const byteCharacters = atob(emailResponse.pdf_base64);
    const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    await downloadBlob(blob, emailResponse.pdf_filename || "document.pdf");
  };

  const downloadEntityAttachments = async () => {
    const attachments = selectedEntity?.attachments || [];
    await Promise.all(
      attachments.map(async (attachment) => {
        const filePath = attachment.file_path || "";
        if (!filePath) return;
        const url = filePath.startsWith("http")
          ? filePath
          : `${API_URL}/${filePath.replace(/^\//, "")}`;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return;
        const blob = await response.blob();
        await downloadBlob(
          blob,
          attachment.filename || filePath.split("/").pop() || "attachment"
        );
      })
    );
  };

  const handleOpenMailClient = async () => {
    if (emailResponse?.pdf_base64) {
      await handleDownloadPdf();
    }
    await downloadEntityAttachments();
    await wait(250);
    window.location.href = buildMailto();
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMailClient}
                >
                  Open in mail client
                </Button>
                {emailResponse.pdf_base64 ? (
                  <Button type="button" variant="outline" onClick={handleDownloadPdf}>
                    Download PDF
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Opening the mail client will download the generated PDF and any proposal attachments first so you can attach them manually.
              </p>
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
