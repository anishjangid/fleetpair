"use client";

import { useRouter } from "next/navigation";
import { LogOut, Shield, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function ProfilePanel() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <div className="app-stack max-w-3xl">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Account
        </p>
        <h1 className="text-2xl font-bold tracking-[-0.035em]">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you appear on the hub board and handover preferences.
        </p>
      </div>

      <Card className="uiverse-soft-card border-border/80 shadow-none">
        <CardContent className="flex flex-wrap items-center gap-4 px-5 py-5">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
              {user.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-[-0.02em]">
              {user.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.role} · {user.hub}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="h-10 w-full justify-start sm:w-auto">
          <TabsTrigger value="overview" className="px-3">
            <UserRound className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="preferences" className="px-3">
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="px-3">
            <Shield className="size-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="uiverse-soft-card border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Hub identity</CardTitle>
              <CardDescription>
                Shown on dispatch actions and shared challenge cards.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name" value={user.name} />
              <Field label="Work email" value={user.email} />
              <Field label="Role" value={user.role} />
              <Field label="Primary hub" value={user.hub} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4 space-y-4">
          <Card className="uiverse-soft-card border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Handover defaults</CardTitle>
              <CardDescription>
                Simulated preferences for this prototype — wired for a future
                fleet pilot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PrefRow
                title="Auto-apply recommended plan"
                description="Start each morning on the booking-maximising match."
                defaultChecked
              />
              <Separator />
              <PrefRow
                title="Highlight critical conflicts"
                description="Pin range conflicts that can drop a booking."
                defaultChecked
              />
              <Separator />
              <PrefRow
                title="Show rent at risk"
                description="Surface ₹ impact when a pairing falls short."
                defaultChecked
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="uiverse-soft-card border-border/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Sign-in</CardTitle>
              <CardDescription>
                Demo accounts use a shared password. Production would use SSO.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" defaultValue="fleetpair" className="h-11" />
              </div>
              <Button
                className="h-10"
                onClick={() =>
                  toast.message("Password change is simulated in this demo.")
                }
              >
                Update password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly className="h-11 bg-muted/40" />
    </div>
  );
}

function PrefRow({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
