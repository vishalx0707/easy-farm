import { useState, useEffect, useRef, useDeferredValue, lazy, Suspense } from "react";
import { motion, MotionConfig } from "motion/react";
import { useAuth, useClerk } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  House,
  Sprout,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Package,
  MessageCircle,
  Truck,
  ChartNoAxesCombined,
  Search,
  SlidersHorizontal,
  Plus,
  Ellipsis,
  LogOut,
  History,
  Users,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketHome } from "@/components/market-home";
import { MarketPrices } from "@/components/market-prices";
import {
  ShopCard,
  cartAddError,
  orderable,
  useBuyerCart,
} from "@/components/buyer-cart";
import { LeafLoader } from "@/components/leaf-loader";
import { Brand } from "@/components/brand";
import { Animate, useSmoothWorkspace } from "@/components/motion";
import type { Edit } from "@/components/trade-editor";
const CartDialog = lazy(() =>
  import("@/components/buyer-cart").then((m) => ({ default: m.CartDialog })),
);
const LocationDialog = lazy(() =>
  import("@/components/location-dialog").then((m) => ({
    default: m.LocationDialog,
  })),
);
const TradeEditor = lazy(() =>
  import("@/components/trade-editor").then((m) => ({ default: m.TradeEditor })),
);
import {
  LotCard,
  LotDetails,
  FarmDetails,
  OfferDetails,
  OrderDetails,
  Facts,
  Empty,
  Section,
  type Go,
} from "@/components/trade-details";
import { ApiError, useApi, publicApi } from "@/lib/api";
import type {
  State,
  Role,
  Farm,
  Action,
  Lot,
  CheckoutRequest,
  CheckoutResult,
} from "@/lib/types";
import { categories, money, time } from "@/lib/utils";
const views = {
  overview: "Overview",
  catalogue: "Shop produce",
  listings: "Crops",
  offers: "Offers",
  orders: "Orders",
  messages: "Messages",
  deliveries: "Deliveries",
  market: "Market prices",
  farms: "Farm profiles",
  farmers: "Find growers",
  history: "Trade history",
};
const icons = {
  overview: House,
  catalogue: ShoppingBasket,
  listings: Sprout,
  offers: Tag,
  orders: Package,
  messages: MessageCircle,
  deliveries: Truck,
  market: ChartNoAxesCombined,
  farms: Sprout,
  farmers: Users,
  history: History,
};
type View = keyof typeof views;
function useAppHeight() {
  useEffect(() => {
    const resize = () =>
      document.documentElement.style.setProperty(
        "--app-height",
        (visualViewport?.height || innerHeight) + "px",
      );
    resize();
    visualViewport?.addEventListener("resize", resize);
    return () => {
      visualViewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
}
export function Marketplace() {
  const { isLoaded, isSignedIn, userId } = useAuth(),
    clerk = useClerk(),
    api = useApi(),
    cache = useQueryClient(),
    navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [farmId, setFarmId] = useState(
      localStorage.getItem("easyfarm-farm") || "",
    ),
    [edit, setEdit] = useState<Edit | null>(null),
    [account, setAccount] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
    [locationOpen, setLocationOpen] = useState(false),
    [farmSearch, setFarmSearch] = useState(""),
    [notice, setNotice] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    contents = useRef<HTMLDivElement>(null);
  const cart = useBuyerCart(userId ?? undefined);
  useAppHeight();
  const query = useQuery({
    queryKey: ["market", userId],
    queryFn: () => api<State>("/api/state"),
    enabled: isLoaded && !!isSignedIn,
    retry: false,
    refetchInterval: 6000,
  });
  const data = query.data,
    role = data?.user?.role === "grower" ? "grower" : "buyer",
    requestedView = (params.get("view") || "overview") as View,
    view = (
      requestedView in views &&
      !(
        (role === "buyer" && ["listings", "farms"].includes(requestedView)) ||
        (role === "grower" && ["catalogue", "farmers"].includes(requestedView))
      )
        ? requestedView
        : "overview"
    ) as View,
    type = params.get("type"),
    detail = params.get("detail");
  useSmoothWorkspace(scroll, contents, !!data);
  const go: Go = (v, t, id) => {
    const p = new URLSearchParams({ view: v });
    if (t && id) {
      p.set("type", t);
      p.set("detail", id);
    }
    navigate("/" + role + "?" + p);
  };
  const mutation = useMutation({
    mutationFn: (a: Action) =>
      api<{ id: string }>("/api/action", { farm: farmId, ...a }),
    onSuccess: async (_, a) => {
      await cache.invalidateQueries({ queryKey: ["market", userId] });
      setNotice(
        (
          {
            listing: "Harvest published.",
            farm: "Farm saved.",
            location: "Location updated.",
            offer:
              "Offer saved and sent to the grower’s portal. Awaiting their response.",
            counter: "New terms sent.",
            message: "Message sent.",
            accept: "Offer accepted. Order created.",
            decline: "Offer declined.",
            payment: "Sample payment recorded.",
            quality: "Simulated sample check recorded.",
            "order-status": "Delivery updated.",
          } as Record<string, string>
        )[a.action] || "Saved.",
      );
    },
    onError: (e) => setNotice(e.message),
  });
  useEffect(() => {
    if (data) {
      const farms = data.farms.filter((f) => f.owned);
      if (!farms.some((f) => f.id === farmId) && farms[0])
        setFarmId(farms[0].id);
    }
  }, [data, farmId]);
  useEffect(() => {
    if (farmId) localStorage.setItem("easyfarm-farm", farmId);
  }, [farmId]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    document.title = (views[view] || "Overview") + " · EasyFarm";
  }, [view, detail]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (isLoaded && !isSignedIn)
    return (
      <Navigate
        to={
          "/login?portal=" +
          (location.pathname === "/grower" ? "grower" : "buyer")
        }
        replace
      />
    );
  if (query.error instanceof ApiError && query.error.status === 401)
    return <Navigate to="/login" replace />;
  if (query.error instanceof ApiError && query.error.status === 409)
    return (
      <Navigate
        to={
          "/onboarding?portal=" +
          (location.pathname === "/grower" ? "grower" : "buyer")
        }
        replace
      />
    );
  if (!data)
    return (
      <div className="startup">
        <Brand />
        {query.error ? (
          <>
            <h1>Let’s reconnect.</h1>
            <p>{query.error.message}</p>
            <Button onClick={() => query.refetch()}>Try again</Button>
          </>
        ) : (
          <>
            <LeafLoader label="Opening your workspace" />
          </>
        )}
      </div>
    );
  if (location.pathname !== "/" + role)
    return <Navigate to={"/" + role + location.search} replace />;
  const user = data.user!,
    farm =
      data.farms.find((f) => f.id === farmId && f.owned) ||
      data.farms.find((f) => f.owned),
    mainNav: View[] = [
      "overview",
      role === "grower" ? "listings" : "catalogue",
      "offers",
      "orders",
      "messages",
    ];
  const secondary: View[] = [
    "deliveries",
    "market",
    role === "grower" ? "farms" : "farmers",
    "history",
  ];
  const nav = (v: View, mobile = false) => {
    const Icon = icons[v];
    return (
      <Button
        key={v}
        variant="ghost"
        data-nav={v}
        aria-current={view === v ? "page" : undefined}
        onClick={() => go(v)}
      >
        {view === v && (
          <motion.i
            className="nav-active"
            layoutId={mobile ? "mobile-active" : "sidebar-active"}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          />
        )}
        <Icon size={mobile ? 21 : 17} />
        <span>
          {mobile && v === "overview"
            ? "Home"
            : mobile && v === "catalogue"
              ? "Shop"
              : views[v]}
        </span>
        {!mobile &&
          v === "offers" &&
          data.offers.filter((o) => o.status === "Pending").length > 0 && (
            <small>
              {data.offers.filter((o) => o.status === "Pending").length}
            </small>
          )}
      </Button>
    );
  };
  const accountButton = (mobile = false) => (
    <button
      id={mobile ? "mobile-account-button" : "account-button"}
      data-account
      className="account-button"
      aria-label="Open account"
      onClick={() => setAccount(true)}
    >
      <span className="avatar">{user.name[0]}</span>
      <span className="account-copy">
        <strong>{user.name}</strong>
        <small>{role === "grower" ? "Grower" : "Buyer"} portal</small>
      </span>
    </button>
  );
  async function save(a: Action) {
    const { id } = await mutation.mutateAsync(a);
    if (a.action === "listing") go("listings", "lot", id);
    if (a.action === "farm" && !a.id) setFarmId(id);
    if (a.action === "offer") go("offers", "offer", id);
  }
  function addToCart(lot: Lot, quantity: number) {
    const error = cartAddError(cart, lot, quantity);
    if (error) return setNotice(error);
    cart.setQuantity(lot.id, quantity);
    setNotice(`${lot.crop}: ${quantity} kg in your cart.`);
  }
  const refreshMarket = () =>
    void cache.invalidateQueries({ queryKey: ["market", userId] });
  async function checkout(request: CheckoutRequest) {
    return api<CheckoutResult>("/api/action", {
      action: "checkout",
      ...request,
    });
  }
  function checkoutDone(result: CheckoutResult) {
    refreshMarket();
    setCartOpen(false);
    const { orders, offers } = result;
    const parts = [
      orders.length &&
        `${orders.length} ${orders.length === 1 ? "order placed" : "orders placed"}`,
      offers.length &&
        `${offers.length} ${offers.length === 1 ? "request sent" : "requests sent"}`,
    ].filter(Boolean);
    setNotice(parts.join(" · ") + ".");
    go(orders.length ? "orders" : "offers");
  }
  let body: React.ReactNode;
  if (type && detail) {
    const common = {
      data,
      role: role as Role,
      go,
      edit: setEdit,
      change: mutation.mutateAsync,
      pending: mutation.isPending,
    };
    const lot = data.listings.find((l) => l.id === detail),
      f = data.farms.find((f) => f.id === detail),
      offer = data.offers.find((o) => o.id === detail),
      order = data.orders.find((o) => o.id === detail);
    body = (
      <>
        <Button
          variant="ghost"
          className="back-button"
          onClick={() => go(view)}
        >
          Back to {views[view] || "workspace"}
        </Button>
        {type === "lot" && lot ? (
          <LotDetails
            lot={lot}
            {...common}
            addToCart={addToCart}
            cartQuantity={cart.quantities[lot.id]}
          />
        ) : type === "farm" && f ? (
          <FarmDetails farm={f} {...common} />
        ) : type === "offer" && offer ? (
          <OfferDetails offer={offer} {...common} />
        ) : type === "order" && order ? (
          <OrderDetails order={order} {...common} />
        ) : (
          <Empty
            title="Record unavailable"
            copy="This record belongs to another account or is no longer available."
          />
        )}
      </>
    );
  } else if (view === "overview")
    body = (
      <MarketHome
        data={data}
        role={role}
        farm={farm}
        go={go}
        edit={setEdit}
        changeLocation={() => setLocationOpen(true)}
      />
    );
  else if (view === "catalogue")
    body = <Catalogue data={data} go={go} cart={cart} add={addToCart} />;
  else if (view === "listings")
    body = (
      <>
        <Section
          title="Your harvest"
          copy={farm?.name + " · " + farm?.location}
        >
          <Button
            data-action="edit-lot"
            onClick={() => farm && setEdit({ kind: "listing", farm })}
          >
            <Plus size={16} />
            List harvest
          </Button>
        </Section>
        <div className="lot-grid">
          {data.listings
            .filter((l) => l.farm === farm?.id)
            .map((l) => (
              <LotCard key={l.id} lot={l} farm={farm} go={go} />
            ))}
        </div>
        {!data.listings.some((l) => l.farm === farm?.id) && (
          <Empty
            title="A fresh start for your harvest."
            copy="Publish your first lot with its quantity, asking price and pickup window."
            action={
              <Button
                onClick={() => farm && setEdit({ kind: "listing", farm })}
              >
                List your first harvest
              </Button>
            }
          />
        )}
      </>
    );
  else if (view === "farms" || view === "farmers")
    body = (
      <>
        <Section
          title={role === "grower" ? "Your farms" : "Meet your next grower"}
          copy="Find a grower by farm, person or locality. Sample farms are labelled."
        >
          {role === "grower" && (
            <Button onClick={() => setEdit({ kind: "farm" })}>
              <Plus size={16} />
              Add farm
            </Button>
          )}
        </Section>
        <div className="catalogue-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              aria-label="Search farms or locality"
              placeholder="Search farms or locality · Chevella, Moinabad…"
              value={farmSearch}
              onChange={(e) => setFarmSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="farm-grid">
          {data.farms
            .filter((f) => role === "buyer" || f.owned)
            .filter((f) =>
              (f.name + " " + f.person + " " + f.location)
                .toLowerCase()
                .includes(farmSearch.toLowerCase()),
            )
            .map((f) => (
              <article className="glass farm-card" key={f.id}>
                <img
                  src={"/" + f.image.replace(/^\//, "")}
                  alt="Representative farm"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p className="eyebrow">
                    {f.sample ? "SAMPLE FARM · " : ""}
                    {f.location}
                  </p>
                  <h3>{f.name}</h3>
                  <p>{f.person}</p>
                  <Button
                    variant="outline"
                    onClick={() => go(view, "farm", f.id)}
                  >
                    View farm
                  </Button>
                </div>
              </article>
            ))}
        </div>
      </>
    );
  else if (view === "market") body = <MarketPrices data={data} />;
  else if (view === "history")
    body = (
      <>
        <Section
          title="Trade history"
          copy="A saved record of your orders and updates."
        />
        {data.history.length ? (
          <div className="glass records">
            {data.history
              .slice()
              .reverse()
              .map((h, i) => (
                <article key={i}>
                  <div>
                    <h3>{h.event}</h3>
                    <p>{time(h.at)}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => go("orders", "order", h.order)}
                  >
                    View order
                  </Button>
                </article>
              ))}
          </div>
        ) : (
          <Empty
            title="Your story starts here."
            copy="Accepted trades, payment labels and delivery updates will appear here."
          />
        )}
      </>
    );
  else
    body = (
      <TradeList view={view} data={data} role={role} farm={farm} go={go} />
    );
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app-shell"
        data-portal={role}
        data-view={type ? "detail" : view}
      >
      <aside className="app-sidebar">
        <Brand />
        {role === "grower" && (
          <div className="farm-switch">
            <Label htmlFor="farm-select">Active farm</Label>
            <select
              id="farm-select"
              value={farm?.id || ""}
              onChange={(e) => setFarmId(e.target.value)}
            >
              {data.farms
                .filter((f) => f.owned)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <nav id="app-nav" aria-label="Workspace navigation">
          {mainNav.map((v) => nav(v))}
          <div className="nav-divider" />
          {secondary.map((v) => nav(v))}
        </nav>
        <footer className="sidebar-bottom">
          {accountButton()}
          <a href="/">Back to EasyFarm</a>
        </footer>
      </aside>
      <main className="workspace">
        <header className="workspace-bar">
          <div className="mobile-brand">
            <Brand />
          </div>
          {role === "grower" && (
            <div className="mobile-farm">
              <select
                aria-label="Active farm"
                value={farm?.id || ""}
                onChange={(e) => setFarmId(e.target.value)}
              >
                {data.farms
                  .filter((f) => f.owned)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="workspace-title">
            <span>{user.organization}</span>
            <h1>{type ? "Trade details" : views[view] || "Overview"}</h1>
          </div>
          <div className="mobile-tools">
            {accountButton(true)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More workspace pages"
                >
                  <Ellipsis size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondary.map((v) => (
                  <DropdownMenuItem key={v} onSelect={() => go(v)}>
                    {views[v]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {role === "buyer" && (
            <Button
              className="workspace-cart"
              variant="outline"
              aria-label={`Open cart, ${cart.count} items`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart size={17} /> Cart{" "}
              {cart.count > 0 && <b>{cart.count}</b>}
            </Button>
          )}
        </header>
        <div
          className="workspace-scroll"
          ref={scroll}
          id="content"
          aria-busy="false"
        >
          <div ref={contents}>
            <Animate identity={view + ":" + (detail || "")}>
              <div
                className={
                  view === "overview" && !type ? "view-home" : "view-content"
                }
              >
                {body}
              </div>
            </Animate>
          </div>
        </div>
        <nav
          className="mobile-nav"
          id="mobile-nav"
          aria-label="Mobile workspace navigation"
        >
          {mainNav.map((v) => nav(v, true))}
        </nav>
      </main>
      {role === "buyer" && cartOpen && (
        <Suspense fallback={null}>
          <CartDialog
            data={data}
            cart={cart}
            close={() => setCartOpen(false)}
            submit={checkout}
            done={checkoutDone}
            refresh={refreshMarket}
          />
        </Suspense>
      )}
      {locationOpen && (
        <Suspense fallback={null}>
          <LocationDialog
            current={user.location}
            close={() => setLocationOpen(false)}
            save={(value) =>
              mutation.mutateAsync({ action: "location", location: value })
            }
          />
        </Suspense>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {edit && (
        <Suspense fallback={null}>
          <TradeEditor
            key={edit.kind + ("lot" in edit ? edit.lot?.id || "new" : "")}
            edit={edit}
            onClose={() => setEdit(null)}
            onSave={save}
          />
        </Suspense>
      )}
      <Dialog open={account} onOpenChange={setAccount}>
        <DialogContent className="account-dialog">
          <DialogHeader>
            <DialogTitle>Your account</DialogTitle>
            <DialogDescription>
              Your Google identity and EasyFarm workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="account-profile">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </div>
          <Facts
            values={[
              ["Portal", role === "grower" ? "Grower" : "Buyer"],
              ["Farm / business", user.organization],
              ["Location", user.location],
            ]}
          />
          <Button
            id="sign-out"
            variant="outline"
            onClick={async () => {
              try {
                await clerk.signOut({ redirectUrl: "/login" });
                cache.clear();
              } catch {
                setNotice(
                  "Could not sign out. Check your connection and try again.",
                );
              }
            }}
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </DialogContent>
      </Dialog>
      </div>
    </MotionConfig>
  );
}
function Catalogue({
  data,
  go,
  cart,
  add,
}: {
  data: State;
  go: Go;
  cart: ReturnType<typeof useBuyerCart>;
  add: (lot: Lot, quantity: number) => void;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [region, setRegion] = useState(""),
    [max, setMax] = useState(""),
    [quality, setQuality] = useState(false),
    [filters, setFilters] = useState(false),
    [showSamples, setShowSamples] = useState(false),
    [sort, setSort] = useState("price"),
    deferred = useDeferredValue(search);
  const list = data.listings
    .filter((l) => {
      const farm = data.farms.find((f) => f.id === l.farm);
      return (
        l.open &&
        l.quantity > 0 &&
        (showSamples ? l.sample : orderable(l)) &&
        (!deferred ||
          (l.crop + " " + (farm?.name ?? "") + " " + (farm?.location ?? ""))
            .toLowerCase()
            .includes(deferred.toLowerCase())) &&
        (!category || l.category === category) &&
        (!region ||
          farm?.location.toLowerCase().includes(region.toLowerCase())) &&
        (!max || l.price <= Number(max)) &&
        (!quality || l.quality.startsWith("Sample"))
      );
    })
    .sort((a, b) => sort === "price" ? a.price - b.price : b.quantity - a.quantity);
  const noGrowerStock = !showSamples && !data.listings.some(orderable);
  const active =
    Number(!!category) + Number(!!region) + Number(!!max) + Number(quality);
  return (
    <>
      <Section
        title="Shop produce"
        copy="Choose how many kilograms you need and add them to your cart."
      />
      <div className="catalogue-toolbar">
        <div className="search-field">
          <Search size={17} />
          <Input
            aria-label="Search produce or farm"
            name="search"
            placeholder="Search produce or farm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setFilters(true)}>
          <SlidersHorizontal size={16} />
          Filters {active > 0 && <span className="filter-count">{active}</span>}
        </Button>
      </div>
      <div className="category-tabs" role="group" aria-label="Crop category">
        {["", ...categories].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c || "All produce"}
          </button>
        ))}
      </div>
      <div className="results-count">
        {list.length} {showSamples ? "sample" : "available"}{" "}
        {list.length === 1 ? "listing" : "listings"}
        <label className="trade-only">
          <input
            type="checkbox"
            checked={showSamples}
            onChange={(e) => setShowSamples(e.target.checked)}
          />{" "}
          Show examples
        </label>
        <select
          aria-label="Sort produce"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="price">Lowest price / kg</option>
          <option value="quantity">Most available</option>
        </select>
      </div>
      <div className="lot-grid" id="lot-grid">
        {list.map((l) => (
          <ShopCard
            key={l.id}
            lot={l}
            farm={data.farms.find((f) => f.id === l.farm)}
            details={() => go("catalogue", "lot", l.id)}
            cart={cart}
            add={add}
          />
        ))}
      </div>
      {!list.length && (
        <Empty
          title={noGrowerStock ? "Nothing to buy yet" : "No matching listings"}
          copy={noGrowerStock ? "Produce appears here when a grower publishes it." : "Try another crop, price or location."}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setCategory("");
                setRegion("");
                setMax("");
                setQuality(false);
                if (noGrowerStock) setShowSamples(true);
              }}
            >
              {noGrowerStock ? "Browse examples" : "Clear filters"}
            </Button>
          }
        />
      )}
      <Dialog open={filters} onOpenChange={setFilters}>
        <DialogContent className="filter-dialog">
          <DialogHeader>
            <DialogTitle>Find your harvest</DialogTitle>
            <DialogDescription>
              Filter by location, asking price and sample quality status.
            </DialogDescription>
          </DialogHeader>
          <div className="filter-fields">
            <Label htmlFor="filter-location">City or region</Label>
            <Input
              id="filter-location"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Chevella, Telangana"
            />
            {data.user?.location && (
              <Button
                variant="ghost"
                onClick={() =>
                  setRegion(data.user!.location.split(",")[0].trim())
                }
              >
                Use my location
              </Button>
            )}
            <Label htmlFor="filter-max">Maximum asking price (₹/kg)</Label>
            <Input
              id="filter-max"
              type="number"
              min="1"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
            <label className="check-field">
              <input
                type="checkbox"
                checked={quality}
                onChange={(e) => setQuality(e.target.checked)}
              />
              Sample check passed (simulated)
            </label>
          </div>
          <Button onClick={() => setFilters(false)}>
            Show {list.length} lots
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function TradeList({
  view,
  data,
  role,
  farm,
  go,
}: {
  view: string;
  data: State;
  role: Role;
  farm?: Farm;
  go: Go;
}) {
  const [sort, setSort] = useState("recent"),
    offers = data.offers
      .filter((o) => role === "buyer" || o.farm === farm?.id)
      .slice()
      .reverse();
  if (sort === "price") offers.sort((a, b) => b.price - a.price);
  if (sort === "value")
    offers.sort((a, b) => b.price * b.quantity - a.price * a.quantity);
  if (view === "orders" || view === "deliveries") {
    const list = data.orders
      .filter((o) => role === "buyer" || o.farm === farm?.id)
      .slice()
      .reverse();
    return (
      <>
        <Section
          title={view === "deliveries" ? "Deliveries" : "Your orders"}
          copy="Agreed terms, saved milestones and pickup windows."
        />
        {list.length ? (
          <div className="records glass">
            {list.map((o) => (
              <article key={o.id}>
                <div className="record-icon">
                  <Truck size={20} />
                </div>
                <div>
                  <h3>{o.crop}</h3>
                  <p>
                    {data.farms.find((f) => f.id === o.farm)?.name} ·{" "}
                    {o.quantity} kg
                  </p>
                  <small>Pickup: {o.pickup}</small>
                </div>
                <div className="record-price">
                  <strong>{money(o.total)}</strong>
                  <Badge variant="outline">{o.status}</Badge>
                </div>
                <Button
                  variant="outline"
                  onClick={() => go("orders", "order", o.id)}
                >
                  View order
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={
              view === "deliveries"
                ? "No pickups on the calendar."
                : "Your first trade is waiting."
            }
            copy={
              role === "grower"
                ? "Accept an incoming offer to create a sale and track its delivery."
                : "Agree terms with a grower to create your first purchase."
            }
            action={
              <Button
                onClick={() => go(role === "grower" ? "offers" : "catalogue")}
              >
                {role === "grower" ? "Review offers" : "Explore produce"}
              </Button>
            }
          />
        )}
      </>
    );
  }
  return (
    <>
      <Section
        title={
          view === "messages"
            ? "Conversations"
            : role === "grower"
              ? "Incoming offers"
              : "Your offers"
        }
        copy={
          view === "messages"
            ? "Every conversation stays connected to its trade."
            : "Compare quantity, price and pickup before you agree."
        }
      >
        {view !== "messages" && (
          <label className="sort-label">
            Compare by
            <select
              aria-label="Compare offers by"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Most recent</option>
              <option value="price">Highest ₹/kg</option>
              <option value="value">Highest total</option>
            </select>
          </label>
        )}
      </Section>
      {offers.length ? (
        <div className="records glass">
          {offers.map((o) => (
            <article key={o.id}>
              <div className="record-icon">
                {view === "messages" ? (
                  <MessageCircle size={20} />
                ) : (
                  <Tag size={20} />
                )}
              </div>
              <div>
                <h3>{o.crop}</h3>
                <p>
                  {role === "grower"
                    ? o.buyerName
                    : data.farms.find((f) => f.id === o.farm)?.name}
                </p>
                {view === "messages" ? (
                  <small className="message-preview">
                    {o.messages.at(-1)?.body || "Start the conversation."}
                  </small>
                ) : (
                  <small>Pickup: {o.pickup}</small>
                )}
              </div>
              <div className="record-price">
                <strong>
                  {money(o.price)}
                  <small>/kg</small>
                </strong>
                <span>
                  {o.quantity} kg · {money(o.quantity * o.price)}
                </span>
                <Badge variant="outline">{o.status}</Badge>
              </div>
              <Button
                variant="outline"
                data-action="offer-detail"
                onClick={() => go(view, "offer", o.id)}
              >
                {view === "messages" ? "Open conversation" : "Open offer"}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            view === "messages"
              ? "Good trade starts with a conversation."
              : "Room for a new connection."
          }
          copy={
            role === "grower"
              ? "Publish your harvest so buyers can send offers and message you."
              : "Make an offer on a grower’s produce. Your terms and messages stay together."
          }
          action={
            <Button
              onClick={() => go(role === "grower" ? "listings" : "catalogue")}
            >
              {role === "grower" ? "Your harvest" : "Explore produce"}
            </Button>
          }
        />
      )}
    </>
  );
}
export function Trace() {
  const [params] = useSearchParams(),
    batch = params.get("batch") || "",
    query = useQuery({
      queryKey: ["trace", batch],
      queryFn: () =>
        publicApi<State>("/api/trace/" + encodeURIComponent(batch)),
      retry: false,
    });
  return (
    <div className="trace-page">
      <header>
        <Brand />
        <a href="/login">Open your workspace</a>
      </header>
      <main>
        {query.data?.orders[0] ? (
          <OrderDetails
            order={query.data.orders[0]}
            data={query.data}
            publicTrace
          />
        ) : query.error ? (
          <Empty title="Trace record unavailable" copy={query.error.message} />
        ) : (
          <p role="status">Opening the saved trace record…</p>
        )}
      </main>
    </div>
  );
}
