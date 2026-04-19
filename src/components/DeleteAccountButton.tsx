"use client";

import { useTransition } from "react";
import { deleteAccountAction } from "@/lib/actions";

export function DeleteAccountButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Delete “${name}”? This removes the account and any interactions or prospects tied to it.`
          )
        ) {
          startTransition(async () => {
            await deleteAccountAction(id);
          });
        }
      }}
      className="btn-danger"
    >
      {pending ? "Deleting…" : "Delete account"}
    </button>
  );
}
