"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
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
