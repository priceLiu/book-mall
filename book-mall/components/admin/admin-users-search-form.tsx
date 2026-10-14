"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialPhone?: string;
  initialName?: string;
};

export function AdminUsersSearchForm({ initialPhone = "", initialName = "" }: Props) {
  const hasFilter = Boolean(initialPhone.trim() || initialName.trim());

  return (
    <form
      method="get"
      action="/admin/users"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-secondary bg-muted/30 p-4"
    >
      <div className="min-w-[12rem] flex-1 space-y-1.5">
        <Label htmlFor="admin-users-phone">手机号</Label>
        <Input
          id="admin-users-phone"
          name="phone"
          type="search"
          inputMode="numeric"
          autoComplete="off"
          placeholder="完整或后几位"
          defaultValue={initialPhone}
          className="bg-background"
        />
      </div>
      <div className="min-w-[12rem] flex-1 space-y-1.5">
        <Label htmlFor="admin-users-name">昵称</Label>
        <Input
          id="admin-users-name"
          name="name"
          type="search"
          autoComplete="off"
          placeholder="模糊匹配"
          defaultValue={initialName}
          className="bg-background"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">搜索</Button>
        {hasFilter ? (
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/users">清除</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
