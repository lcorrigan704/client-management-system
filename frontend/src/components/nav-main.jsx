"use client"

import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  groups,
  activeId,
  onNavigate,
  label = "Navigation",
}) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {groups.map((group, index) => (
          <div key={group.label} className="space-y-2">
            {isCollapsed ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      tooltip={group.label}
                      isActive={group.items.some((item) => item.id === activeId)}
                    >
                      {group.icon && <group.icon className="size-4" />}
                      <span>{group.label}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-48">
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    {group.items?.map((subItem) => (
                      <DropdownMenuItem
                        key={subItem.id}
                        onClick={() => onNavigate(subItem.id)}
                        className={subItem.id === activeId ? "bg-accent text-accent-foreground" : ""}
                      >
                        {subItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                asChild
                defaultOpen={group.items.some((item) => item.id === activeId)}
                className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={group.label}>
                      {group.icon && <group.icon className="size-4" />}
                      <span>{group.label}</span>
                      <ChevronRight
                        className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {group.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={subItem.id === activeId}
                            className="w-full"
                          >
                            <button type="button" onClick={() => onNavigate(subItem.id)}>
                              <span>{subItem.label}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </div>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
