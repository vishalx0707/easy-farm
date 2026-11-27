import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function LocationDialog({
  current,
  close,
  save,
}: {
  current: string;
  close: () => void;
  save: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await save(value.trim());
      close();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="account-dialog location-dialog">
        <DialogHeader>
          <DialogTitle>Change location</DialogTitle>
          <DialogDescription>
            Save your city or region for this account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <Label htmlFor="market-location">City or region</Label>
          <Input
            autoComplete="address-level2"
            id="market-location"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={100}
            required
          />
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? "Saving…" : "Save location"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
