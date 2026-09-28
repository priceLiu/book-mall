"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COMMON_TOOLS_CREDITS_SETTLEMENT_EVENT } from "@/lib/credits-settlement-watch";
import { dispatchCommonToolsCreditsBalanceRefresh } from "@/lib/credits-balance-events";
import { formatCreditsDisplay } from "@/lib/format-credits-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogCancelButton,
  EcomDialogPrimaryButton,
} from "@/components/ui/dialog";

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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const seen = new Set<string>();
    const onSettlement = (event: Event) => {
      const detail = (event as CustomEvent<{
        logId?: string;
        phase?: string;
        credits?: number;
      }>).detail;
      if (!detail?.logId || !detail.phase) return;
      dispatchCommonToolsCreditsBalanceRefresh();
      const key = `${detail.logId}:${detail.phase}`;
      if (seen.has(key)) return;
      seen.add(key);
      const credits = typeof detail.credits === "number" ? detail.credits : 0;
      if (detail.phase === "frozen" && credits > 0) {
        setNotice(`已冻结 ${formatCreditsDisplay(credits)} 积分`);
      } else if ((detail.phase === "settled" || detail.phase === "consumed") && credits > 0) {
        setNotice(`本次消耗 ${formatCreditsDisplay(credits)} 积分`);
      } else if (detail.phase === "released" && credits > 0) {
        setNotice(`生成未完成，已释放冻结的 ${formatCreditsDisplay(credits)} 积分`);
      }
    };
    window.addEventListener(COMMON_TOOLS_CREDITS_SETTLEMENT_EVENT, onSettlement);
    return () => window.removeEventListener(COMMON_TOOLS_CREDITS_SETTLEMENT_EVENT, onSettlement);
  }, []);

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
      {notice ? (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[400] max-w-[min(100vw-2rem,22rem)] rounded-xl border border-[#e8e8ed] bg-white px-4 py-3 text-sm font-medium text-[#1d1d1f] shadow-lg"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <Dialog
        open={modal?.kind === "confirm"}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
      >
        {modal?.kind === "confirm" ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modal.opts.title}</DialogTitle>
              <DialogDescription>{modal.opts.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <EcomDialogCancelButton onClick={() => closeConfirm(false)}>
                {modal.opts.cancelLabel ?? "取消"}
              </EcomDialogCancelButton>
              <EcomDialogPrimaryButton
                destructive={modal.opts.variant === "destructive"}
                onClick={() => closeConfirm(true)}
              >
                {modal.opts.confirmLabel ?? "确认"}
              </EcomDialogPrimaryButton>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={modal?.kind === "alert"}
        onOpenChange={(open) => {
          if (!open) closeAlert();
        }}
      >
        {modal?.kind === "alert" ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modal.opts.title}</DialogTitle>
              <DialogDescription>{modal.opts.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <EcomDialogPrimaryButton onClick={closeAlert}>知道了</EcomDialogPrimaryButton>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={modal?.kind === "double"}
        onOpenChange={(open) => {
          if (!open) closeDouble(false);
        }}
      >
        {modal?.kind === "double" ? (
          <DialogContent>
            {modal.step === 1 ? (
              <>
                <DialogHeader>
                  <DialogTitle>{modal.opts.title}</DialogTitle>
                  <DialogDescription>{modal.opts.message}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <EcomDialogCancelButton onClick={() => closeDouble(false)}>
                    取消
                  </EcomDialogCancelButton>
                  <EcomDialogPrimaryButton
                    onClick={() => setModal({ ...modal, step: 2 })}
                  >
                    下一步
                  </EcomDialogPrimaryButton>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{modal.opts.secondTitle}</DialogTitle>
                  <DialogDescription>{modal.opts.secondMessage}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <EcomDialogCancelButton onClick={() => closeDouble(false)}>
                    取消
                  </EcomDialogCancelButton>
                  <EcomDialogPrimaryButton
                    destructive
                    onClick={() => closeDouble(true)}
                  >
                    {modal.opts.confirmLabel ?? "确认删除"}
                  </EcomDialogPrimaryButton>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </DialogContext.Provider>
  );
}
