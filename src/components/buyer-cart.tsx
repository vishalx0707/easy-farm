import { useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { ApiError } from "@/lib/api";
import { money, photo } from "@/lib/utils";
import type {
  CheckoutItem,
  CheckoutRequest,
  CheckoutResult,
  Farm,
  Lot,
  State,
} from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type CartState = {
  quantities: Record<string, number>;
  submitted?: CheckoutRequest;
};
const emptyCart = (): CartState => ({ quantities: {} });
const maxItems = 12;

export function orderable(lot: Lot) {
  return !lot.sample && lot.open && lot.quantity > 0;
}

export function useBuyerCart(account?: string) {
  const key = account ? "easyfarm:cart:v1:" + account : "";
  const [saved, setSaved] = useState({ key: "", cart: emptyCart() });
  if (saved.key !== key) {
    let cart = emptyCart();
    try {
      const raw = key && localStorage.getItem(key);
      if (raw) cart = JSON.parse(raw) as CartState;
    } catch {
      /* In-memory cart remains available. */
    }
    setSaved({ key, cart });
  }
  const cart = saved.key === key ? saved.cart : emptyCart();
  function write(next: CartState) {
    setSaved({ key, cart: next });
    try {
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep the cart in memory if storage is unavailable. */
    }
  }
  function setQuantity(id: string, quantity: number) {
    write({ quantities: { ...cart.quantities, [id]: quantity } });
  }
  function remove(id: string) {
    const quantities = { ...cart.quantities };
    delete quantities[id];
    write({ quantities });
  }
  return {
    ...cart,
    write,
    setQuantity,
    remove,
    count: Object.keys(cart.quantities).length,
  };
}
type BuyerCart = ReturnType<typeof useBuyerCart>;

function Quantity({
  crop,
  max,
  value,
  set,
}: {
  crop: string;
  max: number;
  value: string;
  set: (value: string) => void;
}) {
  const min = Math.min(0.01, max);
  const number = Number(value);
  function step(direction: number) {
    const next = Number(((number || min) + direction).toFixed(4));
    set(String(Math.max(min, Math.min(max, next))));
  }
  return (
    <div className="quantity-control">
      <button
        type="button"
        aria-label={"Decrease " + crop + " quantity"}
        disabled={number <= min}
        onClick={() => step(-1)}
      >
        <Minus size={15} />
      </button>
      <Input
        aria-label={crop + " quantity (kg)"}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={value}
        onChange={(event) => set(event.target.value)}
      />
      <span>kg</span>
      <button
        type="button"
        aria-label={"Increase " + crop + " quantity"}
        disabled={number >= max}
        onClick={() => step(1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function AddToCart({
  lot,
  saved,
  onAdd,
}: {
  lot: Lot;
  saved?: number;
  onAdd: (lot: Lot, quantity: number) => void;
}) {
  const [value, setValue] = useState(
    String(saved ?? Math.min(lot.quantity, 10)),
  );
  const quantity = Number(value);
  const valid =
    Number.isFinite(quantity) && quantity > 0 && quantity <= lot.quantity;
  return (
    <div className="buy-controls">
      <div>
        <Quantity
          crop={lot.crop}
          max={lot.quantity}
          value={value}
          set={setValue}
        />
        <strong className="buy-line-total">
          {valid ? money(quantity * lot.price) : "—"}
        </strong>
      </div>
      {quantity > lot.quantity && (
        <p className="buy-stock-error">Only {lot.quantity} kg available.</p>
      )}
      <Button
        type="button"
        disabled={!valid}
        onClick={() => onAdd(lot, quantity)}
      >
        {saved === quantity ? "In cart" : saved ? "Update cart" : "Add to cart"}
      </Button>
    </div>
  );
}

export function ShopCard({
  lot,
  farm,
  details,
  cart,
  add,
}: {
  lot: Lot;
  farm?: Farm;
  details: () => void;
  cart: BuyerCart;
  add: (lot: Lot, quantity: number) => void;
}) {
  return (
    <article className="lot-card shop-card">
      <div className="lot-image">
        <img src={photo(lot.category)} alt="" loading="lazy" />
        {lot.sample && <span>Sample · browse only</span>}
        {lot.category === "Tomatoes" && (
          <small className="photo-credit">Generated image</small>
        )}
      </div>
      <div className="shop-card-copy">
        <div className="shop-card-heading">
          <h3>{lot.crop}</h3>
          <p>
            <strong>{money(lot.price)}</strong>
            <small>/kg</small>
          </p>
        </div>
        <p className="shop-farm">
          {farm?.name} · {farm?.location}
        </p>
        <p className="shop-stock">{lot.quantity} kg available</p>
        {orderable(lot) && (
          <AddToCart
            key={cart.quantities[lot.id] ?? ""}
            lot={lot}
            saved={cart.quantities[lot.id]}
            onAdd={add}
          />
        )}
        <div className="shop-details">
          {!lot.sample && (
            <span>{lot.directOrder ? "Instant order" : "Grower confirms"}</span>
          )}
          <Button data-action="lot" variant="ghost" onClick={details}>
            Details
          </Button>
        </div>
      </div>
    </article>
  );
}

function CartQuantity({
  lot,
  quantity,
  update,
}: {
  lot: Lot;
  quantity: number;
  update: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(quantity ? String(quantity) : "");
  return (
    <Quantity
      crop={lot.crop}
      max={lot.quantity}
      value={draft}
      set={(value) => {
        setDraft(value);
        const amount = Number(value);
        update(Number.isFinite(amount) && amount > 0 ? amount : 0);
      }}
    />
  );
}

export function CartDialog({
  data,
  cart,
  close,
  submit,
  done,
  refresh,
}: {
  data: State;
  cart: BuyerCart;
  close: () => void;
  submit: (request: CheckoutRequest) => Promise<CheckoutResult>;
  done: (result: CheckoutResult) => void;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lines = Object.entries(cart.quantities).map(([id, quantity]) => ({
    id,
    quantity,
    lot: data.listings.find((lot) => lot.id === id),
  }));
  const items: CheckoutItem[] = lines.flatMap(({ lot, quantity }) =>
    lot && orderable(lot) && quantity > 0 && quantity <= lot.quantity
      ? [
          {
            listing: lot.id,
            quantity,
            price: lot.price,
            pickup: lot.pickup,
            direct: lot.directOrder === true,
          },
        ]
      : [],
  );
  const reviewed = cart.submitted?.items ?? items;
  const orders = reviewed.filter((item) => item.direct).length;
  const requests = reviewed.length - orders;
  const total =
    reviewed.reduce(
      (sum, item) => sum + Math.round(item.price * item.quantity * 100),
      0,
    ) / 100;
  const canSubmit =
    Boolean(cart.submitted) ||
    (items.length > 0 && items.length === lines.length);
  async function place() {
    if (!canSubmit || busy) return;
    const payload = cart.submitted ?? {
      checkoutId: crypto.randomUUID(),
      items,
    };
    setBusy(true);
    setError("");
    cart.write({ quantities: cart.quantities, submitted: payload });
    try {
      const result = await submit(payload);
      cart.write(emptyCart());
      done(result);
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        (failure.status === 400 ||
          (!cart.submitted && [401, 403, 409, 413].includes(failure.status)))
      ) {
        cart.write({ quantities: cart.quantities });
        refresh();
        setError(failure.message);
      } else {
        setError(
          "Couldn’t confirm checkout. Retry to check the same submission.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  const buttonLabel = cart.submitted
    ? "Retry checkout"
    : requests && orders
      ? "Place orders & send requests"
      : requests
        ? requests === 1
          ? "Send request"
          : "Send requests"
        : orders === 1
          ? "Place order"
          : "Place orders";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="trade-dialog cart-dialog" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Your cart</DialogTitle>
          <DialogDescription>
            Review quantities, prices and pickup. No payment is collected at
            checkout.
          </DialogDescription>
        </DialogHeader>
        {lines.length === 0 ? (
          <p className="cart-empty">
            <ShoppingCart size={21} /> Your cart is empty.
          </p>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map(({ id, quantity, lot }) => {
                const available = lot && orderable(lot);
                const farm = data.farms.find(
                  (candidate) => candidate.id === lot?.farm,
                );
                return (
                  <li key={id}>
                    <div className="cart-line-heading">
                      <h3>{lot?.crop ?? "Unavailable item"}</h3>
                      {lot && <strong>{money(quantity * lot.price)}</strong>}
                    </div>
                    {lot && (
                      <p>
                        {farm?.name} · {money(lot.price)}/kg
                      </p>
                    )}
                    {lot && <p>Pickup: {lot.pickup}</p>}
                    <p>
                      {available
                        ? lot.directOrder
                          ? "Instant order"
                          : "Grower confirms"
                        : "Unavailable"}
                    </p>
                    <div className="cart-line-controls">
                      {available && !cart.submitted ? (
                        <CartQuantity
                          lot={lot}
                          quantity={quantity}
                          update={(value) => cart.setQuantity(id, value)}
                        />
                      ) : (
                        <span>{quantity} kg</span>
                      )}
                      {!cart.submitted && (
                        <Button
                          variant="ghost"
                          aria-label={
                            "Remove " + (lot?.crop ?? "unavailable item")
                          }
                          onClick={() => cart.remove(id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {available &&
                      quantity > lot.quantity &&
                      !cart.submitted && (
                        <p className="buy-stock-error">
                          Only {lot.quantity} kg available.
                        </p>
                      )}
                  </li>
                );
              })}
            </ul>
            <footer className="cart-footer">
              <div>
                <span>Total</span>
                <strong>{canSubmit ? money(total) : "—"}</strong>
              </div>
              {canSubmit && (
                <p>
                  {[
                    orders
                      ? orders +
                        (orders === 1 ? " instant order" : " instant orders")
                      : "",
                    requests
                      ? requests +
                        (requests === 1
                          ? " request for grower approval"
                          : " requests for grower approval")
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {cart.submitted && !busy && !error && (
                <p>
                  Checkout confirmation is pending. Retry to check the same
                  submission.
                </p>
              )}
              {!canSubmit && (
                <p>Update or remove unavailable items to continue.</p>
              )}
              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}
              <Button
                disabled={!canSubmit || busy}
                onClick={() => void place()}
              >
                {busy ? "Submitting…" : buttonLabel}
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function cartAddError(cart: BuyerCart, lot: Lot, quantity: number) {
  if (cart.submitted)
    return "Open your cart to confirm the previous checkout first.";
  if (!orderable(lot) || quantity <= 0 || quantity > lot.quantity)
    return "This quantity is unavailable.";
  if (!(lot.id in cart.quantities) && cart.count >= maxItems)
    return "Your cart can hold up to 12 items.";
  return "";
}
