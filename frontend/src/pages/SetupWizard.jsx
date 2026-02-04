import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { fieldClass, labelClass } from "@/ui/formStyles";

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const days = Array.from({ length: 31 }, (_, i) => i + 1);

const passwordValid = (value) =>
  value.length >= 9 && /[A-Z]/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function SetupWizard({ onSubmit, onCancel }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    owner_email: "",
    password: "",
    company_name: "",
    company_address: "",
    company_invoice_email: "",
    fy_start_month: 1,
    fy_start_day: 1,
    fy_end_month: 12,
    fy_end_day: 31,
    accounts_due_month: 10,
    accounts_due_day: 31,
    confirmation_date_month: 1,
    confirmation_date_day: 27,
    confirmation_due_month: 2,
    confirmation_due_day: 10,
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_sort_code: "",
    bank_iban: "",
    bank_swift: "",
    bank_reference: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_from: "",
    smtp_use_tls: true,
  });

  const steps = useMemo(
    () => [
      {
        title: "Owner account",
        description: "Create the owner login for this workspace.",
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={fieldClass}>
              <label className={labelClass}>Owner email</label>
              <Input
                type="email"
                value={form.owner_email}
                onChange={(event) => setForm({ ...form, owner_email: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 9 characters, 1 uppercase, 1 special character.
              </p>
            </div>
          </div>
        ),
        isValid: form.owner_email && passwordValid(form.password),
      },
      {
        title: "Company profile",
        description: "Shown on documents and email templates.",
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={fieldClass}>
              <label className={labelClass}>Company name</label>
              <Input
                value={form.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Invoice contact email</label>
              <Input
                type="email"
                value={form.company_invoice_email}
                onChange={(event) =>
                  setForm({ ...form, company_invoice_email: event.target.value })
                }
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Company address</label>
              <Textarea
                rows={3}
                value={form.company_address}
                onChange={(event) => setForm({ ...form, company_address: event.target.value })}
              />
            </div>
          </div>
        ),
        isValid: form.company_name.trim().length > 0,
      },
      {
        title: "Financial dates",
        description: "Configure year boundaries and compliance reminders.",
        content: (
          <div className="grid gap-4 md:grid-cols-3">
            <div className={fieldClass}>
              <label className={labelClass}>FY start month</label>
              <Select
                value={String(form.fy_start_month)}
                onValueChange={(value) => setForm({ ...form, fy_start_month: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>FY start day</label>
              <Select
                value={String(form.fy_start_day)}
                onValueChange={(value) => setForm({ ...form, fy_start_day: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>FY end month</label>
              <Select
                value={String(form.fy_end_month)}
                onValueChange={(value) => setForm({ ...form, fy_end_month: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>FY end day</label>
              <Select
                value={String(form.fy_end_day)}
                onValueChange={(value) => setForm({ ...form, fy_end_day: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Accounts due month</label>
              <Select
                value={String(form.accounts_due_month)}
                onValueChange={(value) =>
                  setForm({ ...form, accounts_due_month: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Accounts due day</label>
              <Select
                value={String(form.accounts_due_day)}
                onValueChange={(value) => setForm({ ...form, accounts_due_day: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Confirmation date month</label>
              <Select
                value={String(form.confirmation_date_month)}
                onValueChange={(value) =>
                  setForm({ ...form, confirmation_date_month: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Confirmation date day</label>
              <Select
                value={String(form.confirmation_date_day)}
                onValueChange={(value) =>
                  setForm({ ...form, confirmation_date_day: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Confirmation due month</label>
              <Select
                value={String(form.confirmation_due_month)}
                onValueChange={(value) =>
                  setForm({ ...form, confirmation_due_month: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Confirmation due day</label>
              <Select
                value={String(form.confirmation_due_day)}
                onValueChange={(value) =>
                  setForm({ ...form, confirmation_due_day: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ),
        isValid: true,
      },
      {
        title: "Bank details",
        description: "Optional payment details for invoices.",
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={fieldClass}>
              <label className={labelClass}>Bank name</label>
              <Input
                value={form.bank_name}
                onChange={(event) => setForm({ ...form, bank_name: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Account name</label>
              <Input
                value={form.bank_account_name}
                onChange={(event) =>
                  setForm({ ...form, bank_account_name: event.target.value })
                }
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Account number</label>
              <Input
                value={form.bank_account_number}
                onChange={(event) =>
                  setForm({ ...form, bank_account_number: event.target.value })
                }
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Sort code</label>
              <Input
                value={form.bank_sort_code}
                onChange={(event) => setForm({ ...form, bank_sort_code: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>IBAN</label>
              <Input
                value={form.bank_iban}
                onChange={(event) => setForm({ ...form, bank_iban: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>SWIFT/BIC</label>
              <Input
                value={form.bank_swift}
                onChange={(event) => setForm({ ...form, bank_swift: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Reference</label>
              <Input
                value={form.bank_reference}
                onChange={(event) => setForm({ ...form, bank_reference: event.target.value })}
              />
            </div>
          </div>
        ),
        isValid: true,
      },
      {
        title: "SMTP settings",
        description: "Optional email delivery settings.",
        content: (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={fieldClass}>
              <label className={labelClass}>SMTP host</label>
              <Input
                value={form.smtp_host}
                onChange={(event) => setForm({ ...form, smtp_host: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>SMTP port</label>
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(event) =>
                  setForm({ ...form, smtp_port: Number(event.target.value) })
                }
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>SMTP username</label>
              <Input
                value={form.smtp_username}
                onChange={(event) => setForm({ ...form, smtp_username: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>SMTP password</label>
              <Input
                type="password"
                value={form.smtp_password}
                onChange={(event) => setForm({ ...form, smtp_password: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>From address</label>
              <Input
                value={form.smtp_from}
                onChange={(event) => setForm({ ...form, smtp_from: event.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Use TLS</label>
              <Select
                value={form.smtp_use_tls ? "true" : "false"}
                onValueChange={(value) =>
                  setForm({ ...form, smtp_use_tls: value === "true" })
                }
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
          </div>
        ),
        isValid: true,
      },
    ],
    [form]
  );

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Welcome to your workspace</CardTitle>
          <CardDescription>Let’s set up your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{currentStep.title}</span>
              <span>
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <Progress value={progress} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>

          {currentStep.content}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((prev) => prev + 1)} disabled={!currentStep.isValid}>
                  Continue
                </Button>
              ) : (
                <Button onClick={() => onSubmit(form)} disabled={!currentStep.isValid}>
                  Finish setup
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
