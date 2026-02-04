import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass, labelClass } from "@/ui/formStyles";

export default function AuthPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your CMS workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={fieldClass}>
            <label className={labelClass}>Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => onLogin({ email, password })}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
