import { MapPin, Sprout, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { State, Role, Farm } from "@/lib/types";
import type { Edit } from "./trade-editor";
import type { Go } from "./trade-details";
import { MarketPrices } from "./market-prices";
import { money, photo } from "@/lib/utils";

export function MarketHome({
  data,
  role,
  farm,
  go,
  edit,
  changeLocation,
}: {
  data: State;
  role: Role;
  farm?: Farm;
  go: Go;
  edit: (e: Edit) => void;
  changeLocation: () => void;
}) {
  const grower = role === "grower";
  const open = data.listings.filter((l) => l.open && l.quantity > 0);
  const published = open.filter((l) => !l.sample);
  const lots = grower
    ? open.filter((l) => l.farm === farm?.id)
    : [...published].sort((a, b) => a.price - b.price);
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
              : "Buyer overview"}
          </h2>
          <p>
            {grower
              ? farm?.name + " · " + farm?.location
              : data.user?.organization}
          </p>
        </div>
        <button
          className="location-link"
          onClick={changeLocation}
          aria-label={
            "Change location: " +
            (data.user?.location || "Hyderabad, Telangana")
          }
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
              : featured
                ? "LOWEST LISTED PRICE"
                : "SHOP PRODUCE"}
          </p>
          <h3>
            {featured
              ? grower
                ? "Your harvest.\nYour terms."
                : featured.crop
              : grower
                ? "Something good\nis growing."
                : "Nothing to buy yet"}
          </h3>
          <p className="feature-origin">
            {grower
              ? featured?.crop || "Publish a lot to start trading."
              : source
                ? `${source.name} · ${source.location}`
                : "Produce appears when growers publish stock."}
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
            {grower ? "List harvest" : "Shop produce"}
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
            <h3>{grower ? "Your harvest" : "Available to buy"}</h3>
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
              <p>
                {grower
                  ? "Your first harvest belongs here."
                  : "No grower listings are available."}
              </p>
              {grower && (
                <button onClick={() => farm && edit({ kind: "listing", farm })}>
                  List a harvest
                </button>
              )}
            </div>
          )}
          <footer>
            {grower
              ? `${total.toLocaleString("en-IN")} kg listed across ${lots.length} lots`
              : `${published.length} ${published.length === 1 ? "listing" : "listings"}`}
          </footer>
        </section>
        <MarketPrices data={data} compact onOpen={() => go("market")} />
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
      </footer>
    </section>
  );
}
