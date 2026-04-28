"use client";

import { useCallback, useRef, useState } from "react";
import { apiClient, parseFieldErrors } from "../../../../../lib/api-client";
import { useToast } from "../../../../../components/ui/ToastProvider";
import { Modal } from "../../../../../components/ui/Modal";
import type { AppDetail } from "./utils";

interface EditAppModalProps {
  open: boolean;
  app: AppDetail;
  onClose: () => void;
  onSaved: (app: AppDetail) => void;
}

export function EditAppModal({
  open,
  app,
  onClose,
  onSaved,
}: EditAppModalProps) {
  const [name, setName] = useState(app.name);
  const [desc, setDesc] = useState(app.description ?? "");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const close = useCallback(() => {
    setNameError("");
    setName(app.name);
    setDesc(app.description ?? "");
    onClose();
  }, [app.name, app.description, onClose]);

  const handleSave = useCallback(async () => {
    setNameError("");
    if (!name.trim()) {
      setNameError("App name is required");
      return;
    }
    setSaving(true);
    const res = await apiClient<AppDetail>(`/merchant/apps/${app.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim(),
        description: desc.trim() || undefined,
      }),
    });
    if (res.success && res.data) {
      onSaved(res.data);
      toast("success", "App updated");
      onClose();
    } else {
      const { fieldErrors, fallbackMessage } = parseFieldErrors(res, [
        "name",
        "description",
      ]);
      if (fieldErrors.name) setNameError(fieldErrors.name);
      if (fallbackMessage) toast("error", fallbackMessage);
      else if (!fieldErrors.name)
        toast("error", res.error?.message ?? "Failed to update app");
    }
    setSaving(false);
  }, [app.id, name, desc, onSaved, onClose, toast]);

  return (
    <Modal
      open={open}
      onClose={close}
      onSubmit={handleSave}
      title="Edit App"
      initialFocusRef={nameRef}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="edit-app-name"
            className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
          >
            App Name
          </label>
          <input
            id="edit-app-name"
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "edit-app-name-error" : undefined}
            className={`w-full px-4 py-2.5 text-[13px] bg-recur-base border rounded-[10px] text-recur-text-heading focus:outline-none motion-safe:transition-colors ${
              nameError
                ? "border-recur-error"
                : "border-recur-border focus:border-recur-primary"
            }`}
          />
          {nameError && (
            <p
              id="edit-app-name-error"
              className="text-[11px] text-recur-error mt-1"
            >
              {nameError}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="edit-app-desc"
            className="block text-[11px] font-semibold text-recur-text-muted uppercase tracking-wider mb-1.5"
          >
            Description
          </label>
          <input
            id="edit-app-desc"
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full px-4 py-2.5 text-[13px] bg-recur-base border border-recur-border rounded-[10px] text-recur-text-heading focus:outline-none focus:border-recur-primary motion-safe:transition-colors"
          />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary text-[13px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={close} className="btn-secondary text-[13px] px-5 py-2">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
