import { MapPin, Sprout, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { State, Role, Farm } from "@/lib/types";
import type { Edit } from "./trade-editor";
import type { Go } from "./trade-details";
import { money, photo } from "@/lib/utils";

export function MarketHome({
  data,
  role,
  farm,
  go,
  edit,
}: {
  data: State;
  role: Role;
  farm?: Farm;
  go: Go;
  edit: (e: Edit) => void;
}) {
  const grower = role === "grower";
  const open = data.listings.filter((l) => l.open && l.quantity > 0);
  const published = open.filter((l) => !l.sample);
  const lots = grower
    ? open.filter((l) => l.farm === farm?.id)
    : [...open].sort(
        (a, b) => Number(a.sample) - Number(b.sample) || a.price - b.price,
      );
  const featured = lots[0];
  const source = data.farms.find((f) => f.id === featured?.farm);
  const pending = data.offers.filter(
    (o) => o.status === "Pending" && (!grower || o.farm === farm?.id),
  );
  const active = data.orders.filter(
    (o) => o.status !== "Delivered" && (!grower || o.farm === farm?.id),
  );
  const total = lots.reduce((sum, l) => sum + l.quantity, 0);
  return (
    <section className="market-home">
      <header className="home-heading">
        <div>
          <p className="eyebrow">
            {grower ? "YOUR GROWING BUSINESS" : "YOUR BUYING DESK"}
          </p>
          <h2>
            {grower
              ? `Good morning, ${data.user!.name.split(" ")[0]}.`
              : "Fresh opportunities."}
          </h2>
          <p>
            {grower
              ? farm?.name + " · " + farm?.location
              : "Good produce. Direct connections."}
          </p>
        </div>
        <button
          className="location-link"
          onClick={() => go(grower ? "farms" : "farmers")}
        >
          <MapPin size={15} />
          {data.user?.location || "Hyderabad, Telangana"}
        </button>
      </header>

      <article className="market-feature glass">
        <div className="feature-copy">
          <p className="eyebrow">
            {grower
              ? "FROM YOUR FARM"
              : published.length
                ? "LOWEST LISTED PRICE"
                : "EXPLORE THE MARKET · SAMPLE LOT"}
          </p>
          <h3>
            {featured
              ? grower
                ? "Your harvest.\nYour terms."
                : featured.crop
              : grower
                ? "Something good\nis growing."
                : "Your next grower\nis out there."}
          </h3>
          <p className="feature-origin">
            {grower
              ? featured?.crop || "Publish a lot to start trading."
              : source
                ? `${source.name} · ${source.location}`
                : "Discover farm-published harvests."}
          </p>
          <div className="feature-terms">
            {featured ? (
              <>
                <strong>
                  {money(featured.price)}
                  <small>/kg</small>
                </strong>
                <span>
                  {featured.quantity} kg available
                  <br />
                  {featured.sample
                    ? "Illustrative asking price"
                    : "Grower asking price"}
                </span>
              </>
            ) : (
              <Sprout size={36} strokeWidth={1} />
            )}
          </div>
          <Button
            data-action={grower ? "edit-lot" : "browse"}
            onClick={() =>
              grower ? farm && edit({ kind: "listing", farm }) : go("catalogue")
            }
          >
            {grower ? "List harvest" : "Browse produce"}
          </Button>
        </div>
        <div className="feature-image">
          <img
            src={photo(featured?.category || "Tomatoes")}
            alt="Representative produce"
          />
          <span>
            {!featured || featured.category === "Tomatoes"
              ? "Generated produce image"
              : "Representative imagery"}
          </span>
        </div>
      </article>

      <div className="home-market-row">
        <section className="harvest-table cream-panel">
          <header>
            <h3>{grower ? "Your harvest" : "Available harvests"}</h3>
            <button onClick={() => go(grower ? "listings" : "catalogue")}>
              View all
            </button>
          </header>
          {lots.length ? (
            lots.slice(0, 3).map((l) => (
              <button
                className="harvest-row"
                key={l.id}
                onClick={() =>
                  go(grower ? "listings" : "catalogue", "lot", l.id)
                }
              >
                <img src={photo(l.category)} alt="" />
                <span>
                  <strong>{l.crop}</strong>
                  <small>
                    {grower
                      ? l.pickup
                      : data.farms.find((f) => f.id === l.farm)?.location}
                    {l.sample ? " · Sample" : ""}
                  </small>
                </span>
                <span className="harvest-stock">{l.quantity} kg</span>
                <b>
                  {money(l.price)}
                  <small>/kg</small>
                </b>
              </button>
            ))
          ) : (
            <div className="home-empty">
              <Sprout size={24} />
              <p>Your first harvest belongs here.</p>
              <button onClick={() => farm && edit({ kind: "listing", farm })}>
                List a harvest
              </button>
            </div>
          )}
          <footer>
            {grower
              ? `${total.toLocaleString("en-IN")} kg listed across ${lots.length} lots`
              : `${published.length} grower-published lots · Sample lots are browse only`}
          </footer>
        </section>
        <section className="market-pulse glass">
          <header>
            <p className="eyebrow">MARKET PERSPECTIVE</p>
            <span>Sample</span>
          </header>
          <h3>{grower ? "Peppers are moving." : "Know your price."}</h3>
          <div className="pulse-price">
            <strong>
              ₹36<small>/kg</small>
            </strong>
            <span>Illustrative pepper price</span>
          </div>
          <svg
            viewBox="0 0 280 65"
            role="img"
            aria-label="Illustrative pepper prices: 34, 33, 35, 34, 37, 36, 36 rupees per kilogram"
          >
            <path d="M0 52H280M0 22H280" stroke="currentColor" opacity=".12" />
            <path
              d="M2 42L45 50L90 35L135 42L181 18L226 27L277 27"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="277" cy="27" r="3" fill="currentColor" />
          </svg>
          <p>Illustrative reference. No live feed or price prediction.</p>
          <button onClick={() => go("market")}>Compare market prices</button>
        </section>
      </div>
      <footer className="home-activity">
        <button onClick={() => go("offers")}>
          <MessageCircle size={17} />
          <strong>{pending.length}</strong>
          {grower ? "incoming offers" : "open offers"}
        </button>
        <button onClick={() => go("orders")}>
          <Package size={17} />
          <strong>{active.length}</strong>orders underway
        </button>
        <span>Terms agreed directly. Every update saved.</span>
      </footer>
    </section>
  );
}
