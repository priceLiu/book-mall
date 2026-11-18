"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import type { AnimatedAuthField } from "@/components/auth/animated-auth-ui";

export function AuthHomeV2Fields({
  fields,
  passwordVisible = false,
  onTogglePassword,
}: {
  fields: AnimatedAuthField[];
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
}) {
  return (
    <div className="auth-v2-fields">
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="auth-v2-label">
            {field.label}
            {field.required !== false ? (
              <span className="text-red-500" aria-hidden>
                {" "}
                *
              </span>
            ) : null}
          </label>
          <div className="relative">
            <input
              id={field.name}
              name={field.name}
              type={
                field.type === "password"
                  ? passwordVisible
                    ? "text"
                    : "password"
                  : field.type
              }
              placeholder={field.placeholder}
              value={field.value}
              onChange={field.onChange}
              required={field.required !== false}
              disabled={field.disabled}
              autoComplete={
                field.type === "email"
                  ? "email"
                  : field.type === "password"
                    ? "current-password"
                    : field.type === "tel"
                      ? "tel"
                      : undefined
              }
              className={`auth-v2-input${field.type === "password" ? " pr-10" : ""}`}
            />
            {field.type === "password" && onTogglePassword ? (
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--muted)]"
                aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
              >
                {passwordVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthHomeV2SubmitButton({
  children,
  disabled,
  loading,
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button type="submit" className="auth-v2-submit" disabled={disabled || loading}>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}