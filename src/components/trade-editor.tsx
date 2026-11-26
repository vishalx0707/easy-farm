import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { categories } from "@/lib/utils";
import type { Action, Farm, Lot, Offer } from "@/lib/types";
export type Edit =
  | { kind: "listing"; lot?: Lot; farm: Farm }
  | { kind: "farm"; farm?: Farm }
  | { kind: "offer"; lot: Lot }
  | { kind: "counter"; offer: Offer };
const required = z.string().trim().min(1).max(500),
  amount = z.coerce.number().positive().max(10000000);
const schemas = {
  listing: z.object({
    crop: required,
    category: required,
    quantity: amount,
    price: amount,
    grade: required,
    harvest: z.string().max(500),
    pickup: required,
    notes: z.string().max(500),
  }),
  farm: z.object({
    name: required,
    person: required,
    location: required,
    bio: z.string().max(500),
  }),
  offer: z.object({
    quantity: amount,
    price: amount,
    pickup: required,
    message: z.string().max(500),
  }),
  counter: z.object({ quantity: amount, price: amount, pickup: required }),
};
export function TradeEditor({
  edit,
  onClose,
  onSave,
}: {
  edit: Edit;
  onClose: () => void;
  onSave: (action: Action) => Promise<void>;
}) {
  const [error, setError] = useState("");
  let initial: Record<string, string> = {};
  if (edit.kind === "listing")
    initial = {
      crop: edit.lot?.crop || "",
      category: edit.lot?.category || "Peppers",
      quantity: String(edit.lot?.quantity || ""),
      price: String(edit.lot?.price || ""),
      grade: edit.lot?.grade || "A",
      harvest: edit.lot?.harvest || "",
      pickup: edit.lot?.pickup || "",
      notes: edit.lot?.notes || "",
    };
  if (edit.kind === "farm")
    initial = {
      name: edit.farm?.name || "",
      person: edit.farm?.person || "",
      location: edit.farm?.location || "",
      bio: edit.farm?.bio || "",
    };
  if (edit.kind === "offer" || edit.kind === "counter") {
    const terms = edit.kind === "offer" ? edit.lot : edit.offer;
    initial = {
      quantity: String(
        edit.kind === "offer" ? Math.min(25, terms.quantity) : terms.quantity,
      ),
      price: String(terms.price),
      pickup: terms.pickup,
      message: "",
    };
  }
  const form = useForm<Record<string, string>>({ defaultValues: initial });
  const title =
    edit.kind === "listing"
      ? edit.lot
        ? "Edit harvest lot"
        : "List your harvest"
      : edit.kind === "farm"
        ? edit.farm
          ? "Edit farm profile"
          : "Create farm profile"
        : edit.kind === "offer"
          ? "Make an offer"
          : "Propose new terms";
  const field = (name: string, label: string, type = "text", wide = false) => (
    <div className={wide ? "field-wide" : ""} key={name}>
      <Label htmlFor={"field-" + name}>{label}</Label>
      {type === "textarea" ? (
        <Textarea
          id={"field-" + name}
          maxLength={500}
          rows={3}
          {...form.register(name)}
        />
      ) : (
        <Input
          id={"field-" + name}
          type={type}
          required={!["harvest", "notes", "bio", "message"].includes(name)}
          maxLength={500}
          {...(type === "number"
            ? { min: 0.01, step: 0.01, max: 10000000 }
            : {})}
          {...form.register(name)}
        />
      )}
    </div>
  );
  async function submit(values: Record<string, string>) {
    setError("");
    const parsed = schemas[edit.kind].safeParse(values);
    if (!parsed.success) {
      setError(
        "Check your details. Names and terms are required; quantity and price must be greater than zero.",
      );
      return;
    }
    try {
      const identity =
        edit.kind === "listing"
          ? { farm: edit.farm.id, id: edit.lot?.id }
          : edit.kind === "farm"
            ? { id: edit.farm?.id }
            : edit.kind === "offer"
              ? { listing: edit.lot.id }
              : { offer: edit.offer.id, farm: edit.offer.farm };
      await onSave({ action: edit.kind, ...identity, ...parsed.data });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.formState.isSubmitting) onClose();
      }}
    >
      <DialogContent className="trade-dialog" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {edit.kind === "listing"
              ? "Clear quantity, price and pickup terms help buyers make an offer."
              : edit.kind === "farm"
                ? "Help buyers get to know the person behind the harvest."
                : "Your quantity, price and pickup window travel with this offer."}
          </DialogDescription>
        </DialogHeader>
        <form id="editor-form" onSubmit={form.handleSubmit(submit)}>
          <div className="fields" id="fields">
            {edit.kind === "listing" ? (
              <>
                {field("crop", "Crop name", "text", true)}
                <div>
                  <Label htmlFor="category">Crop type</Label>
                  <select id="category" {...form.register("category")}>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {field("grade", "Grade (grower declared)")}
                {field("quantity", "Available quantity (kg)", "number")}
                {field("price", "Asking price (₹/kg)", "number")}
                {field("harvest", "Harvest date", "date")}
                {field("pickup", "Pickup window")}
                {field("notes", "Notes", "textarea", true)}
              </>
            ) : edit.kind === "farm" ? (
              <>
                {field("name", "Farm name", "text", true)}
                {field("person", "Grower name")}
                {field("location", "City or region")}
                {field("bio", "About your farm", "textarea", true)}
              </>
            ) : (
              <>
                {field("quantity", "Quantity (kg)", "number")}
                {field("price", "Your price (₹/kg)", "number")}
                {field("pickup", "Pickup window", "text", true)}
                {edit.kind === "offer" &&
                  field(
                    "message",
                    "Message to the grower (optional)",
                    "textarea",
                    true,
                  )}
              </>
            )}
          </div>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={form.formState.isSubmitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              id="save-editor"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Saving…"
                : edit.kind === "listing"
                  ? "Publish harvest"
                  : edit.kind === "offer"
                    ? "Send offer"
                    : edit.kind === "counter"
                      ? "Send counteroffer"
                      : "Save farm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
