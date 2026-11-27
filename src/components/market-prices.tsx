import { useState } from "react";
import { MapPin } from "lucide-react";
import type { State } from "@/lib/types";
import { money, photo } from "@/lib/utils";
import { orderable } from "./buyer-cart";
import { Section } from "./trade-details";
import { Button } from "./ui/button";

export function MarketPrices({
  data,
  compact = false,
  onOpen,
}: {
  data: State;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [search, setSearch] = useState("");
  const current = data.listings
    .filter(orderable)
    .sort((a, b) => a.price - b.price);
  const sample = current.length === 0;
  const examples = data.listings.filter((lot) => lot.sample && lot.open);
  const listings = (sample ? examples : current).filter((lot) => {
    const farm = data.farms.find((entry) => entry.id === lot.farm);
    return [lot.crop, farm?.name, farm?.location]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });
  return (
    <section
      className={
        compact
          ? "market-pulse glass current-prices compact-prices"
          : "current-prices"
      }
    >
      {compact ? (
        <header>
          <h3>Current market prices</h3>
          <Button variant="ghost" onClick={onOpen}>
            See all
          </Button>
        </header>
      ) : (
        <>
          <Section
            title="Current market prices"
            copy="Asking prices per kilogram from active EasyFarm listings."
          />
          <label className="price-search" htmlFor="price-search">
            Find a vegetable or farm
            <input
              id="price-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. Tomatoes or Chevella"
            />
          </label>
        </>
      )}
      {sample && (
        <p className="price-source">
          No active grower prices yet. Sample prices below.
        </p>
      )}
      {listings.length ? (
        <ul className={compact ? "price-rows" : "price-rows glass"}>
          {listings.slice(0, compact ? 3 : undefined).map((lot) => {
            const farm = data.farms.find((entry) => entry.id === lot.farm);
            return (
              <li key={lot.id}>
                <img src={photo(lot.crop)} alt="" loading="lazy" decoding="async" />
                <div>
                  <strong>{lot.crop}</strong>
                  {!compact && <small>{farm?.name}</small>}
                </div>
                {!compact && (
                  <span className="price-origin">
                    <MapPin size={14} />
                    {farm?.location}
                  </span>
                )}
                <b>
                  {money(lot.price)}
                  <small>/kg</small>
                </b>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="price-source">
          {search
            ? "No matching prices."
            : "Prices appear when growers publish stock."}
        </p>
      )}
    </section>
  );
}
