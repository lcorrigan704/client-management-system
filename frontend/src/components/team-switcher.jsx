import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function TeamSwitcher({
  teams = [],
  activeTeamId,
  onTeamSwitch,
  onCreateTeam,
  onSetDefaultTeam,
  onUpdateTeam,
}) {
  const { isMobile } = useSidebar();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [renameValue, setRenameValue] = React.useState("");
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [setDefault, setSetDefault] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const isMac = React.useMemo(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform),
    []
  );

  React.useEffect(() => {
    if (!teams?.length) return;
    if (activeTeamId) {
      const exact = teams.find((team) => team.id === activeTeamId);
      if (exact) {
        setActiveTeam(exact);
        return;
      }
    }
    setActiveTeam((prev) => {
      if (!prev) return teams[0];
      const match = teams.find((team) => team.id === prev.id);
      return match || teams[0];
    });
  }, [teams, activeTeamId]);

  const handleSwitch = async (team) => {
    try {
      if (onTeamSwitch) {
        await onTeamSwitch(team.id);
      }
      setActiveTeam(team);
      toast.success(`Switched to ${team.name}.`);
    } catch (error) {
      toast.error(error.message || "Unable to switch workspace.");
    }
  };

  const handleCreateWorkspace = async () => {
    const nextName = workspaceName.trim();
    if (!nextName) {
      toast.error("Workspace name is required.");
      return;
    }
    try {
      setSaving(true);
      await onCreateTeam?.({ name: nextName, set_default: setDefault });
      setWorkspaceName("");
      setSetDefault(true);
      setCreateOpen(false);
      toast.success("Workspace created.");
    } catch (error) {
      toast.error(error.message || "Unable to create workspace.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (team) => {
    try {
      await onSetDefaultTeam?.(team.id);
      toast.success(`${team.name} is now your default workspace.`);
    } catch (error) {
      toast.error(error.message || "Unable to set default workspace.");
    }
  };

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const tag = (event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) {
        return;
      }
      const match = /^Digit([1-9])$/.exec(event.code || "");
      if (!match) return;
      const index = Number(match[1]) - 1;
      const target = teams[index];
      if (!target) return;
      const usesShortcut = isMac
        ? event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey
        : event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
      if (!usesShortcut) return;
      event.preventDefault();
      handleSwitch(target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMac, teams]);

  const handleRenameWorkspace = async () => {
    const nextName = renameValue.trim();
    if (!activeTeam?.id || !nextName) return;
    try {
      setSaving(true);
      await onUpdateTeam?.(activeTeam.id, { name: nextName });
      setRenameOpen(false);
      toast.success("Workspace renamed.");
    } catch (error) {
      toast.error(error.message || "Unable to rename workspace.");
    } finally {
      setSaving(false);
    }
  };

  if (!activeTeam) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeTeam.name}</span>
                <span className="truncate text-xs capitalize">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[max(20rem,var(--radix-dropdown-menu-trigger-width))] max-w-[26rem] rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem key={team.id} onClick={() => handleSwitch(team)} className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <team.logo className="size-4 shrink-0" />
                </div>
                <span className="min-w-0 flex-1 truncate">{team.name}</span>
                <DropdownMenuShortcut>{isMac ? `⌥⇧${index + 1}` : `Ctrl+Shift+${index + 1}`}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setRenameValue(activeTeam.name || "");
                  }}
                  className="gap-2 p-2"
                >
                  Rename active workspace
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Rename workspace</DialogTitle>
                  <DialogDescription>
                    Update the workspace display name used across this context.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Workspace name</label>
                  <Input
                    className="w-full"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleRenameWorkspace} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              onClick={() => {
                if (activeTeam && !activeTeam.isDefault) {
                  handleSetDefault(activeTeam);
                }
              }}
              className="gap-2"
            >
              <Checkbox
                checked={Boolean(activeTeam?.isDefault)}
                className="my-auto"
                aria-label="Set active workspace as default"
              />
              <span className="my-auto">Set active workspace as default</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(event) => event.preventDefault()}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Create workspace</div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create workspace</DialogTitle>
                  <DialogDescription>
                    Create a separate business workspace and optionally set it as default.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Workspace name</label>
                    <Input
                      className="w-full"
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      placeholder="e.g. 704 Consultancy (Client B)"
                    />
                  </div>
                  <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                    <Checkbox
                      checked={setDefault}
                      onCheckedChange={(value) => setSetDefault(value === true)}
                    />
                    Set as default workspace
                  </label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateWorkspace} disabled={saving}>
                    {saving ? "Creating..." : "Create workspace"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
