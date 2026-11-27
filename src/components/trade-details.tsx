import { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Package,
  Check,
  Clock,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, photo, steps, time } from "@/lib/utils";
import type { Action, Lot, Offer, Order, State, Farm, Role } from "@/lib/types";
import type { Edit } from "./trade-editor";
import { AddToCart, orderable } from "./buyer-cart";
export type Go = (view: string, type?: string, id?: string) => void;
export type Change = (action: Action) => Promise<{ id: string }>;
export function Facts({ values }: { values: [string, React.ReactNode][] }) {
  return (
    <dl className="facts">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Empty({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <SproutIcon />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}
function SproutIcon() {
  return <Package size={23} strokeWidth={1.3} />;
}
export function LotCard({ lot, farm, go }: { lot: Lot; farm?: Farm; go: Go }) {
  const view = farm?.owned ? "listings" : "catalogue";
  return (
    <article className="lot-card">
      <button
        className="lot-image"
        aria-label={"View " + lot.crop}
        onClick={() => go(view, "lot", lot.id)}
      >
        <img src={photo(lot.category)} alt={lot.crop} loading="lazy" />
        {lot.category === "Tomatoes" && (
          <small className="photo-credit">Generated image</small>
        )}
        <span>
          {lot.sample
            ? "Sample lot"
            : lot.quality.startsWith("Sample")
              ? "Sample checked"
              : "Grower declared"}
        </span>
      </button>
      <div className="lot-copy">
        <p className="eyebrow">
          {farm?.location} · {farm?.name}
        </p>
        <div className="lot-title">
          <h3>{lot.crop}</h3>
          <strong>
            {money(lot.price)}
            <small>/kg</small>
          </strong>
        </div>
        <div className="lot-bottom">
          <span>
            {lot.quantity} kg · Grade {lot.grade}
          </span>
          <Button
            size="sm"
            variant="outline"
            data-action="lot"
            onClick={() => go(view, "lot", lot.id)}
          >
            View lot
          </Button>
        </div>
      </div>
    </article>
  );
}
export function LotDetails({
  lot,
  data,
  role,
  go,
  edit,
  change,
  pending,
  addToCart,
  cartQuantity,
}: {
  lot: Lot;
  data: State;
  role: Role;
  go: Go;
  edit: (e: Edit) => void;
  change: Change;
  pending: boolean;
  addToCart: (lot: Lot, quantity: number) => void;
  cartQuantity?: number;
}) {
  const farm = data.farms.find((f) => f.id === lot.farm)!;
  const owned = role === "grower" && farm.owned;
  return (
    <div className="detail-layout">
      <div className="detail-visual">
        <img src={photo(lot.category)} alt={lot.crop} />
        <p>
          {lot.category === "Tomatoes"
            ? "AI-generated representative produce image"
            : "Representative produce photography"}
        </p>
      </div>
      <section className="glass panel">
        <p className="eyebrow">CROP LOT · {lot.category}</p>
        <h2>{lot.crop}</h2>
        <button
          className="farm-inline"
          onClick={() => go("farmers", "farm", farm.id)}
        >
          <MapPin size={14} />
          {farm.name} · {farm.location}
        </button>
        <div className="price-large">
          {money(lot.price)}
          <span>/ kg</span>
        </div>
        <Facts
          values={[
            ["Available", lot.quantity + " kg"],
            ["Grade (grower declared)", lot.grade],
            ["Harvest", lot.harvest || "Not supplied"],
            ["Pickup", lot.pickup],
            ["Quality", lot.quality],
          ]}
        />
        {lot.notes && <p className="notes">{lot.notes}</p>}
        {lot.sample && (
          <p className="simulation-note">
            Sample listing · ordering unavailable.
          </p>
        )}
        {role === "buyer" && orderable(lot) && (
          <p className="trade-recipient">
            <MessageCircle size={14} />{" "}
            {lot.directOrder
              ? `Order at the listed price from ${farm.name}.`
              : `${farm.name} confirms your request before it becomes an order.`}
          </p>
        )}
        {role === "buyer" && orderable(lot) && (
          <AddToCart
            key={cartQuantity ?? ""}
            lot={lot}
            saved={cartQuantity}
            onAdd={addToCart}
          />
        )}
        <div className="actions">
          {role === "buyer" && !lot.sample && lot.open && lot.quantity > 0 && (
            <Button
              variant="outline"
              data-action="new-offer"
              onClick={() => edit({ kind: "offer", lot })}
            >
              Make an offer
            </Button>
          )}
          {owned && (
            <>
              <Button onClick={() => edit({ kind: "listing", lot, farm })}>
                Edit listing
              </Button>
              {!lot.quality.startsWith("Sample") && (
                <Button
                  variant="outline"
                  data-action="quality"
                  disabled={pending}
                  onClick={() =>
                    void change({
                      action: "quality",
                      listing: lot.id,
                      farm: lot.farm,
                    }).catch(() => {})
                  }
                >
                  Run sample quality check
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            onClick={() => go("farmers", "farm", farm.id)}
          >
            View farm
          </Button>
        </div>
      </section>
    </div>
  );
}
export function FarmDetails({
  farm,
  data,
  go,
  edit,
}: {
  farm: Farm;
  data: State;
  go: Go;
  edit: (e: Edit) => void;
}) {
  return (
    <>
      <div className="farm-profile glass">
        <img
          src={"/" + farm.image.replace(/^\//, "")}
          alt="Representative farm"
        />
        <div>
          <p className="eyebrow">
            {farm.sample ? "SAMPLE FARM" : "MEET THE GROWER"}
          </p>
          <h2>{farm.name}</h2>
          <p className="farm-person">
            {farm.person} · {farm.location}
          </p>
          <p>{farm.bio || "This grower is preparing their farm story."}</p>
          {farm.owned && (
            <Button
              variant="outline"
              onClick={() => edit({ kind: "farm", farm })}
            >
              Edit farm profile
            </Button>
          )}
        </div>
      </div>
      <Section title="Available harvest" />
      <div className="lot-grid">
        {data.listings
          .filter((l) => l.farm === farm.id && l.open)
          .map((l) => (
            <LotCard key={l.id} lot={l} farm={farm} go={go} />
          ))}
      </div>
    </>
  );
}
export function Section({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-row">
      <div>
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      {children}
    </div>
  );
}
function Thread({
  offer,
  role,
  data,
  change,
  pending,
}: {
  offer: Offer;
  role: Role;
  data: State;
  change: Change;
  pending: boolean;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [offer.messages.length]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || pending) return;
    setError("");
    try {
      await change({
        action: "message",
        offer: offer.id,
        farm: offer.farm,
        message: text.trim(),
      });
      setText("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="glass panel thread">
      <div className="thread-title">
        <MessageCircle size={18} />
        <h2>Direct messages</h2>
        <span className="private-label">Private</span>
      </div>
      <div
        className="messages"
        ref={ref}
        data-lenis-prevent
        role="log"
        aria-live="polite"
        aria-label="Trade conversation"
      >
        {offer.messages.length ? (
          offer.messages.map((m, i) => (
            <div className={"message " + (m.by === role ? "own" : "")} key={i}>
              <small>
                {m.by === "grower"
                  ? data.farms.find((f) => f.id === offer.farm)?.person
                  : offer.buyerName}{" "}
                · {time(m.at)}
              </small>
              <p>{m.body}</p>
            </div>
          ))
        ) : (
          <p className="thread-empty">
            Confirm the grade, quantity and pickup together.
          </p>
        )}
      </div>
      <form id="message-form" onSubmit={send}>
        <Label className="sr-only" htmlFor="message">
          Message
        </Label>
        <Input
          id="message"
          name="message"
          placeholder="Write a message…"
          maxLength={500}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          Send
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function OfferDetails({
  offer,
  data,
  role,
  go,
  edit,
  change,
  pending,
}: {
  offer: Offer;
  data: State;
  role: Role;
  go: Go;
  edit: (e: Edit) => void;
  change: Change;
  pending: boolean;
}) {
  const respond = offer.status === "Pending" && offer.by !== role,
    order = data.orders.find((o) => o.offer === offer.id);
  async function act(action: string) {
    try {
      const { id } = await change({
        action,
        offer: offer.id,
        farm: offer.farm,
      });
      if (action === "accept") go("orders", "order", id);
    } catch {
      /* The workspace shows the API error. */
    }
  }
  return (
    <div className="trade-detail-grid">
      <section className="glass panel">
        <p className="eyebrow">
          {role === "grower"
            ? offer.buyerName
            : data.farms.find((f) => f.id === offer.farm)?.name}
        </p>
        <div className="detail-heading">
          <h2>{offer.crop}</h2>
          <Badge variant="outline">{offer.status}</Badge>
        </div>
        <div className="price-large">
          {money(offer.price)}
          <span>/ kg</span>
        </div>
        <Facts
          values={[
            ["Quantity", offer.quantity + " kg"],
            ["Offer value", money(offer.quantity * offer.price)],
            ["Pickup", offer.pickup],
            [
              "Lot asking price",
              money(
                data.listings.find((l) => l.id === offer.listing)?.price ||
                  offer.price,
              ) + "/kg",
            ],
            ["Last proposal", offer.by === "grower" ? "Grower" : "Buyer"],
            [
              "Recipient",
              role === "buyer"
                ? data.farms.find((f) => f.id === offer.farm)?.person ||
                  "Grower"
                : offer.buyerPerson,
            ],
          ]}
        />
        {respond ? (
          <div className="actions">
            <Button
              data-action="accept"
              disabled={pending}
              onClick={() => void act("accept")}
            >
              Accept offer
            </Button>
            <Button
              data-action="counter"
              variant="outline"
              onClick={() => edit({ kind: "counter", offer })}
            >
              Counteroffer
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => void act("decline")}
            >
              Decline
            </Button>
          </div>
        ) : (
          offer.status === "Pending" && (
            <p className="waiting">
              <Clock size={14} />
              Waiting for the {offer.by === "grower" ? "buyer" : "grower"} to
              respond.
            </p>
          )
        )}
        {order && (
          <Button onClick={() => go("orders", "order", order.id)}>
            View order
          </Button>
        )}
      </section>
      <Thread
        offer={offer}
        role={role}
        data={data}
        change={change}
        pending={pending}
      />
    </div>
  );
}
export function OrderDetails({
  order,
  data,
  role,
  go,
  change,
  pending = false,
  publicTrace = false,
}: {
  order: Order;
  data: State;
  role?: Role;
  go?: Go;
  change?: Change;
  pending?: boolean;
  publicTrace?: boolean;
}) {
  const farm = data.farms.find((f) => f.id === order.farm)!,
    index = steps.indexOf(order.status),
    next = steps[index + 1];
  return (
    <div className="order-layout">
      <section className="glass panel">
        <p className="eyebrow">
          {publicTrace ? "PUBLIC ORDER TRACE" : "CONFIRMED ORDER"} ·{" "}
          {order.id.slice(0, 11)}
        </p>
        <h2>{order.crop}</h2>
        <div className="order-summary">
          <strong>{money(order.total)}</strong>
          <span>
            {order.quantity} kg at {money(order.price)}/kg
          </span>
          <Badge>{order.payment}</Badge>
        </div>
        <ol className="timeline">
          {steps.map((s, i) => (
            <li key={s} className={i <= index ? "reached" : ""}>
              <span>{i <= index ? <Check size={13} /> : i + 1}</span>
              <div>
                <strong>{s}</strong>
                <small>
                  {order.timeline.find((t) => t.event === s)
                    ? time(order.timeline.find((t) => t.event === s)!.at)
                    : "Pending"}
                </small>
              </div>
            </li>
          ))}
        </ol>
        <p id="milestone-note" className="status-note" aria-live="polite">
          Current status: {order.status}.
        </p>
        <Facts
          values={[
            ["Grower", farm.name + " · " + farm.person],
            ["Origin", farm.location],
            ...(!publicTrace
              ? [
                  ["Buyer", order.buyerName || "Business buyer"] as [
                    string,
                    string,
                  ],
                ]
              : []),
            ["Quantity", order.quantity + " kg"],
            ["Grade and quality", order.grade + " · " + order.quality],
            ["Harvest", order.harvest || "Not supplied"],
            ["Pickup", order.pickup],
            ["Payment", order.payment],
          ]}
        />
        {!publicTrace && (
          <div className="actions">
            {role === "grower" && next && (
              <Button
                data-action="status"
                disabled={pending}
                onClick={() =>
                  void change?.({
                    action: "order-status",
                    order: order.id,
                    farm: order.farm,
                    status: next,
                  }).catch(() => {})
                }
              >
                Mark {next.toLowerCase()}
              </Button>
            )}
            {role === "buyer" && order.payment === "Unpaid" && (
              <Button
                data-action="payment"
                disabled={pending}
                onClick={() =>
                  void change?.({ action: "payment", order: order.id }).catch(
                    () => {},
                  )
                }
              >
                Record sample payment
              </Button>
            )}
            {order.offer && (
              <Button
                variant="outline"
                onClick={() => go?.("messages", "offer", order.offer)}
              >
                Open messages
              </Button>
            )}
          </div>
        )}
      </section>
      <aside className="cream-panel trace-panel">
        <p className="eyebrow">
          <ShieldCheck size={13} /> FROM FARM TO HANDOFF
        </p>
        <h2>Order trace record</h2>
        <div className="qr-wrap">
          <img
            width="156"
            height="156"
            src={"/api/qr/" + order.id}
            alt={"QR code for order " + order.id}
          />
        </div>
        <a href={"/app.html?batch=" + encodeURIComponent(order.id)}>
          Open trace link
        </a>
        <p className="trace-hint">
          A read-only record of this trade. Local links require access to this
          computer.
        </p>
        <h3>Transaction history</h3>
        <ol className="event-list">
          {data.history
            .filter((h) => h.order === order.id)
            .map((h, i) => (
              <li key={i}>
                <strong>{h.event}</strong>
                <small>{time(h.at)}</small>
              </li>
            ))}
        </ol>
        <p className="simulation-note">
          Payment and quality checks are simulations. No money moves and no
          independent inspection is performed.
        </p>
      </aside>
    </div>
  );
}
