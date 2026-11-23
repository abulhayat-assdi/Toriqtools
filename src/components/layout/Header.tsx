"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, User, X, Trash2, ChevronDown } from "lucide-react";
import SiteConfirmModal from "@/components/ui/SiteConfirmModal";
import { pushEcommerce, pushEvent, cartLineToItem } from "@/lib/analytics";

export default function Header({ logoVersion }: { logoVersion?: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, itemId: "", title: "", message: "" });
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [navCategories, setNavCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string; slug: string; parent_id: string }[]>([]);
  const catHref = (c: { slug: string; name: string }) => `/collections/${c.slug || c.name.toLowerCase().replace(/\s+/g, "-")}`;
  const subsOf = (id: string) => subCategories.filter(s => s.parent_id === id);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [logoSrc, setLogoSrc] = useState(logoVersion ? `/logo.png?v=${logoVersion}` : "/logo.png");
  const router = useRouter();
  const pathname = usePathname();
  // Active-route helpers: a category counts as active on its own page or any of its subcategories.
  const isActivePath = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const isCatActive = (c: { id: string; slug: string; name: string }) =>
    isActivePath(catHref(c)) || subsOf(c.id).some(s => isActivePath(catHref(s)));
  const navPill = (active: boolean) =>
    `inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-4 text-[13.5px] leading-none tracking-[0.01em] transition-all duration-200 ${
      active
        ? "border-white bg-white font-semibold text-[#eb1c24] shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
        : "border-white/30 bg-white/[0.08] font-medium text-white hover:border-white/70 hover:bg-white/20"
    }`;
  const mobileItem = (active: boolean) =>
    `px-4 py-3 text-[15px] rounded-lg transition-colors ${
      active ? "bg-white font-semibold text-[#eb1c24]" : "font-medium text-white/80 hover:text-white hover:bg-white/10"
    }`;
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the cart was opened via hash-state (icon click / cart:add)
  // vs via the /cart URL (BottomNav link). Lets the two close paths work independently.
  const cartOpenedViaHash = useRef(false);
  const cartOpenRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(d => setUser(d.user || null));
  }, []);

  useEffect(() => {
    if (!logoVersion) {
      fetch("/api/logo-version")
        .then(r => r.json())
        .then(d => { if (d.v) setLogoSrc(`/logo.png?v=${d.v}`); })
        .catch(() => {});
    }
  }, [logoVersion]);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(json => {
      if (json.data) {
        // Main categories in the nav; subcategories nest under their parent.
        type ApiCat = { id: string; name: string; slug: string; parent_id: string | null; show_in_header?: boolean };
        const all: ApiCat[] = json.data;
        const mainCats = all.filter(c => !c.parent_id);
        const headerCats = mainCats.filter(c => c.show_in_header);
        setNavCategories(headerCats.length > 0 ? headerCats : mainCats.slice(0, 6));
        setSubCategories(all.filter((c): c is ApiCat & { parent_id: string } => !!c.parent_id));
      }
    });
  }, []);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(json => {
      if (json.data) setAllProducts(json.data);
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) { try { const p = JSON.parse(saved); if (Array.isArray(p)) setCartItems(p); } catch {} }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keep ref in sync so event handlers can read current cart state without stale closure.
  useEffect(() => {
    cartOpenRef.current = cartOpen;
  }, [cartOpen]);

  // Close the cart drawer when the browser back button removes the #cart history entry.
  useEffect(() => {
    const handlePopState = () => {
      if (cartOpenedViaHash.current) {
        cartOpenedViaHash.current = false;
        setCartOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Open the search panel from the BottomNav's custom event.
  useEffect(() => {
    const handleSearchOpen = () => setSearchOpen(true);
    window.addEventListener("search:open", handleSearchOpen);
    return () => window.removeEventListener("search:open", handleSearchOpen);
  }, []);

  useEffect(() => {
    if (pathname === "/cart") {
      setCartOpen(true);
    } else if (cartOpenRef.current && !cartOpenedViaHash.current) {
      // Cart was opened via the /cart URL (BottomNav link) and user navigated away —
      // close the drawer so it doesn't linger over the new page.
      setCartOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = (menuOpen || searchOpen || cartOpen) ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [menuOpen, searchOpen, cartOpen]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [searchOpen]);

  useEffect(() => {
    const handleCartAdd = (e: any) => {
      const item = e.detail;
      if (item?.id) {
        setCartItems(prev => {
          const exists = prev.find(i => i.id === item.id);
          const updated = exists
            ? prev.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i)
            : [...prev, { ...item, quantity: 1 }];
          localStorage.setItem("cart", JSON.stringify(updated));
          return updated;
        });
        if (!cartOpenRef.current) {
          cartOpenedViaHash.current = true;
          history.pushState({ cartOpen: true }, "", "#cart");
        }
        setCartOpen(true);
      } else {
        const saved = localStorage.getItem("cart");
        if (saved) { try { setCartItems(JSON.parse(saved)); } catch {} }
      }
    };
    const handleCartClear = () => { setCartItems([]); setCartOpen(false); };
    window.addEventListener("cart:add", handleCartAdd);
    window.addEventListener("cart:clear", handleCartClear);
    return () => {
      window.removeEventListener("cart:add", handleCartAdd);
      window.removeEventListener("cart:clear", handleCartClear);
    };
  }, []);

  const cartTotal = cartItems.reduce((acc, item) => {
    return acc + parseFloat(item.price.replace(/[^0-9.]/g, "") || "0") * item.quantity;
  }, 0);

  const cartCount = cartItems.reduce((acc, i) => acc + (i.quantity || 1), 0);

  const searchResults = searchQuery.trim()
    ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // view_item_list-style one-shot: view_cart once per drawer open (all open paths).
  // Reads localStorage so items added in the same tick as the open are included.
  useEffect(() => {
    if (!cartOpen) return;
    try {
      const lines = JSON.parse(localStorage.getItem("cart") || "[]");
      if (!Array.isArray(lines) || lines.length === 0) return;
      pushEcommerce("view_cart", { items: lines.map((l: any) => cartLineToItem(l)) });
    } catch {}
  }, [cartOpen]);

  // search: debounced, term length >= 2, once per distinct term
  const lastSearchTerm = useRef("");
  const resultsCountRef = useRef(0);
  useEffect(() => {
    resultsCountRef.current = searchResults.length;
  });
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2 || term === lastSearchTerm.current) return;
    const t = setTimeout(() => {
      lastSearchTerm.current = term;
      pushEvent("search", { search_term: term, results_count: resultsCountRef.current });
    }, 800);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const openCart = () => {
    if (!cartOpenRef.current) {
      cartOpenedViaHash.current = true;
      history.pushState({ cartOpen: true }, "", "#cart");
    }
    setCartOpen(true);
  };

  const closeCart = () => {
    setCartOpen(false);
    if (cartOpenedViaHash.current) {
      cartOpenedViaHash.current = false;
      if (window.location.hash === "#cart") history.back();
    } else if (pathname === "/cart") {
      router.back();
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    setMenuOpen(false); setSearchOpen(false); setCartOpen(false);
    if (pathname === "/") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  return (
    <>
      {/* ── STICKY HEADER ── */}
      <header
        className={`sticky top-0 z-[100] w-full transition-all duration-300 ${
          scrolled ? "shadow-md" : ""
        } bg-[#eb1c24]`}
      >
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center justify-between gap-4 px-4 py-2 md:px-8 relative">

          {/* Left: Hamburger (mobile only) + Logo (desktop only) */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="md:hidden text-white"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            {/* Desktop logo — hidden on mobile */}
            <Link href="/" onClick={handleLogoClick} className="hidden md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Toriq Tools"
                width={4504}
                height={2793}
                className="h-[48px] w-auto object-contain rounded-md bg-white px-2 py-1"
              />
            </Link>
          </div>

          {/* Mobile logo — absolutely centered, hidden on desktop */}
          <Link href="/" onClick={handleLogoClick} className="md:hidden absolute left-1/2 -translate-x-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Toriq Tools"
              width={4504}
              height={2793}
              className="h-[42px] w-auto object-contain rounded-md bg-white px-1.5 py-0.5"
            />
          </Link>

          {/* Center: Desktop Nav Links — single-line pills, wrap neatly into rows if space runs out */}
          <nav className="hidden md:flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 lg:gap-2.5">
            <Link href="/" className={navPill(isActivePath("/"))} aria-current={isActivePath("/") ? "page" : undefined}>
              Home
            </Link>
            {navCategories.map(cat => {
              const subs = subsOf(cat.id);
              const active = isCatActive(cat);
              return (
                <div key={cat.id} className="relative group">
                  <Link
                    href={catHref(cat)}
                    prefetch={true}
                    className={navPill(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    {cat.name}
                    {subs.length > 0 && (
                      <ChevronDown size={14} className="-mr-1 opacity-80 transition-transform duration-200 group-hover:rotate-180" />
                    )}
                  </Link>
                  {subs.length > 0 && (
                    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full z-[90] pt-2">
                      <div className="min-w-[200px] overflow-hidden rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/5">
                        {subs.map(sub => {
                          const subActive = isActivePath(catHref(sub));
                          return (
                            <Link
                              key={sub.id}
                              href={catHref(sub)}
                              aria-current={subActive ? "page" : undefined}
                              className={`block whitespace-nowrap rounded-lg px-3.5 py-2 text-[14px] transition-colors ${
                                subActive
                                  ? "bg-[#eb1c24]/10 font-semibold text-[#eb1c24]"
                                  : "text-[#333] hover:bg-[#f5f5f5] hover:text-[#eb1c24]"
                              }`}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <Link
              href="/pages/contact"
              className={navPill(isActivePath("/pages/contact"))}
              aria-current={isActivePath("/pages/contact") ? "page" : undefined}
            >
              Contact
            </Link>
          </nav>

          {/* Right: Search, Account, Cart */}
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </button>
            <Link
              href={user ? "/account-order" : "/account-register"}
              className="hidden md:flex p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Account"
            >
              <User size={20} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 z-[110] w-[280px] bg-[#eb1c24] flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Toriq Tools" width={4504} height={2793} className="h-[34px] w-auto" />
              <button onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white"><X size={22} /></button>
            </div>
            <div className="flex flex-col p-4 gap-1">
              <Link href="/" onClick={() => setMenuOpen(false)} className={mobileItem(isActivePath("/"))}>
                Home
              </Link>
              {navCategories.map(cat => (
                <div key={cat.id} className="flex flex-col">
                  <Link
                    href={catHref(cat)}
                    prefetch={true}
                    onClick={() => setMenuOpen(false)}
                    className={mobileItem(isActivePath(catHref(cat)))}
                  >
                    {cat.name}
                  </Link>
                  {subsOf(cat.id).map(sub => (
                    <Link
                      key={sub.id}
                      href={catHref(sub)}
                      onClick={() => setMenuOpen(false)}
                      className={`ml-4 pl-4 pr-4 py-2 text-[14px] rounded-lg border-l transition-colors ${
                        isActivePath(catHref(sub))
                          ? "border-white bg-white/15 font-semibold text-white"
                          : "border-white/15 text-white/65 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ))}
              <Link href="/collections/all" onClick={() => setMenuOpen(false)} className={mobileItem(isActivePath("/collections/all"))}>
                All Products
              </Link>
              <Link href="/pages/contact" onClick={() => setMenuOpen(false)} className={mobileItem(isActivePath("/pages/contact"))}>
                Contact
              </Link>
              <div className="my-2 border-t border-white/10" />
              <Link
                href={user ? "/account-order" : "/account-register"}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <User size={18} /> {user ? "My Account" : "Login / Register"}
              </Link>
            </div>
          </nav>
        </>
      )}

      {/* ── SEARCH PANEL ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
          <div className="absolute top-0 left-0 right-0 bg-white shadow-xl p-4 md:p-6" onClick={e => e.stopPropagation()}>
            <div className="mx-auto max-w-[680px]">
              <div className="flex items-center gap-3 border-b-2 border-[#eb1c24] pb-3">
                <Search size={20} className="text-[#eb1c24] shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 text-[18px] text-[#1a1a1a] outline-none bg-transparent placeholder:text-[#aaa]"
                />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-[#666] hover:text-[#222]">
                  <X size={22} />
                </button>
              </div>
              <div className="pt-4 max-h-[60vh] overflow-y-auto">
                {searchQuery.trim() ? (
                  searchResults.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#999]">{searchResults.length} products found</p>
                      {searchResults.slice(0, 8).map(p => (
                        <Link
                          key={p.id}
                          href={`/products/${p.slug}`}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors group"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-[#eee]">
                            {p.media_urls?.[0] && <img src={p.media_urls[0]} alt={p.name} className="h-full w-full object-contain" loading="lazy" />}
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#222] group-hover:text-[#eb1c24] transition-colors">{p.name}</p>
                            <p className="text-[13px] text-[#eb1c24] font-bold">৳{p.price}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#999] text-center py-10">"{searchQuery}" — No products found</p>
                  )
                ) : (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#999] mb-3">Popular Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {navCategories.map(cat => (
                        <Link
                          key={cat.id}
                          href={`/collections/${cat.slug}`}
                          onClick={() => setSearchOpen(false)}
                          className="px-4 py-2 bg-[#f5f5f5] hover:bg-[#eb1c24] hover:text-white rounded-full text-[13px] font-medium text-[#444] transition-colors"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50" onClick={closeCart}>
          <aside className="ml-auto flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eee]">
              <h2 className="text-[18px] font-bold text-[#1a1a1a]">Your Cart ({cartCount})</h2>
              <button onClick={closeCart} className="text-[#666] hover:text-[#222]"><X size={22} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center gap-4">
                  <ShoppingBag size={48} className="text-[#ddd]" />
                  <p className="text-[16px] font-semibold text-[#666]">Your cart is empty</p>
                  <Link
                    href="/collections/all"
                    onClick={() => setCartOpen(false)}
                    className="bg-[#eb1c24] text-white px-6 py-3 text-[14px] font-semibold hover:bg-[#c4141b] transition-colors"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex gap-3 pb-4 border-b border-[#f0f0f0]">
                      <div className="h-20 w-20 shrink-0 overflow-hidden bg-white border border-[#eee]">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><ShoppingBag size={20} className="text-[#ccc]" /></div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-2">
                          <p className="text-[14px] font-semibold text-[#1a1a1a] leading-tight">{item.name}</p>
                          <button
                            onClick={() => setConfirmModal({ isOpen: true, itemId: item.id, title: "Remove Item?", message: `Remove "${item.name}" from your cart?` })}
                            className="text-[#ccc] hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center border border-[#ddd]">
                            <button
                              className="px-2.5 py-1 text-[#666] hover:text-[#222] text-[14px]"
                              onClick={() => setCartItems(prev => {
                                const u = prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i);
                                localStorage.setItem("cart", JSON.stringify(u)); return u;
                              })}
                            >−</button>
                            <span className="px-3 py-1 text-[14px] font-medium">{item.quantity}</span>
                            <button
                              className="px-2.5 py-1 text-[#666] hover:text-[#222] text-[14px]"
                              onClick={() => setCartItems(prev => {
                                const u = prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                                localStorage.setItem("cart", JSON.stringify(u)); return u;
                              })}
                            >+</button>
                          </div>
                          <span className="text-[14px] font-bold text-[#1a1a1a]">
                            ৳{(parseFloat(item.price.replace(/[^0-9.]/g, "")) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="border-t border-[#eee] bg-white p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[15px] font-semibold text-[#1a1a1a]">Total</span>
                  <span className="text-[20px] font-bold text-[#eb1c24]">৳{cartTotal.toLocaleString()}</span>
                </div>
                <Link
                  href="/checkout"
                  onClick={() => setCartOpen(false)}
                  className="flex w-full items-center justify-center bg-[#eb1c24] py-4 text-[15px] font-bold uppercase tracking-wider text-white hover:bg-[#c4141b] transition-colors"
                >
                  Checkout
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}

      <SiteConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          const removed = cartItems.find(i => i.id === confirmModal.itemId);
          if (removed) pushEcommerce("remove_from_cart", { items: [cartLineToItem(removed)] });
          setCartItems(prev => {
            const u = prev.filter(i => i.id !== confirmModal.itemId);
            localStorage.setItem("cart", JSON.stringify(u)); return u;
          });
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </>
  );
}
