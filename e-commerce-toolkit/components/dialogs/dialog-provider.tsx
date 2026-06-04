"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ModalPortal } from "@/components/common/modal-portal";
import { ButtonPrimaryPill } from "@/components/ui/button-primary";
import { cn } from "@/lib/utils";

type ConfirmOpts = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type AlertOpts = {
  title: string;
  message: string;
  variant?: "default" | "error";
};

type DialogContextValue = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  alert: (opts: AlertOpts) => Promise<void>;
  doubleConfirm: (opts: {
    title: string;
    message: string;
    secondTitle: string;
    secondMessage: string;
    confirmLabel?: string;
  }) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialogs must be used within DialogProvider");
  }
  return ctx;
}

type ModalState =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOpts; resolve: () => void }
  | {
      kind: "double";
      step: 1 | 2;
      opts: {
        title: string;
        message: string;
        secondTitle: string;
        secondMessage: string;
        confirmLabel?: string;
      };
      resolve: (v: boolean) => void;
    }
  | null;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setModal({ kind: "confirm", opts, resolve });
    });
  }, []);

  const alert = useCallback((opts: AlertOpts) => {
    return new Promise<void>((resolve) => {
      setModal({ kind: "alert", opts, resolve });
    });
  }, []);

  const doubleConfirm = useCallback(
    (opts: {
      title: string;
      message: string;
      secondTitle: string;
      secondMessage: string;
      confirmLabel?: string;
    }) => {
      return new Promise<boolean>((resolve) => {
        setModal({ kind: "double", step: 1, opts, resolve });
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ confirm, alert, doubleConfirm }),
    [confirm, alert, doubleConfirm],
  );

  function closeConfirm(ok: boolean) {
    if (modal?.kind === "confirm") {
      modal.resolve(ok);
      setModal(null);
    }
  }

  function closeAlert() {
    if (modal?.kind === "alert") {
      modal.resolve();
      setModal(null);
    }
  }

  function closeDouble(ok: boolean) {
    if (modal?.kind === "double") {
      modal.resolve(ok);
      setModal(null);
    }
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
      {modal?.kind === "confirm" ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-none">
              <h3 className="text-lg font-semibold">{modal.opts.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ecom-muted)]">
                {modal.opts.message}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm"
                  onClick={() => closeConfirm(false)}
                >
                  {modal.opts.cancelLabel ?? "取消"}
                </button>
                <ButtonPrimaryPill
                  size="sm"
                  className={cn(
                    modal.opts.variant === "destructive" && "bg-red-600",
                  )}
                  onClick={() => closeConfirm(true)}
                >
                  {modal.opts.confirmLabel ?? "确认"}
                </ButtonPrimaryPill>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
      {modal?.kind === "alert" ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-[18px] bg-white p-6">
              <h3 className="text-lg font-semibold">{modal.opts.title}</h3>
              <p className="mt-2 text-sm text-[var(--ecom-muted)]">{modal.opts.message}</p>
              <div className="mt-6 flex justify-end">
                <ButtonPrimaryPill size="sm" onClick={closeAlert}>
                  知道了
                </ButtonPrimaryPill>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
      {modal?.kind === "double" ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-[18px] bg-white p-6">
              {modal.step === 1 ? (
                <>
                  <h3 className="text-lg font-semibold">{modal.opts.title}</h3>
                  <p className="mt-2 text-sm text-[var(--ecom-muted)]">
                    {modal.opts.message}
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => closeDouble(false)}>
                      取消
                    </button>
                    <ButtonPrimaryPill
                      size="sm"
                      onClick={() =>
                        setModal({ ...modal, step: 2 })
                      }
                    >
                      下一步
                    </ButtonPrimaryPill>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">{modal.opts.secondTitle}</h3>
                  <p className="mt-2 text-sm text-[var(--ecom-muted)]">
                    {modal.opts.secondMessage}
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => closeDouble(false)}>
                      取消
                    </button>
                    <ButtonPrimaryPill
                      size="sm"
                      className="bg-red-600"
                      onClick={() => closeDouble(true)}
                    >
                      {modal.opts.confirmLabel ?? "确认删除"}
                    </ButtonPrimaryPill>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </DialogContext.Provider>
  );
}
