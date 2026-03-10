"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    Trash2,
    Loader2,
    PackageOpen,
    CheckCircle2,
    X,
    Receipt,
    Clock,
    ChevronLeft,
    ChevronRight,
    Calendar,
    DollarSign,
    CreditCard,
    Banknote,
    ArrowLeftRight,
    User,
    ScanBarcode,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Check,
    Pencil,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface WarehouseRef {
    id: number;
    name: string;
    sort_order: number;
}

interface SearchResult {
    variant_id: number;
    product_id: number;
    product_name: string;
    attribute_values: string[] | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    stock_by_warehouse: Record<number, number>;
    total_stock: number;
}

interface CartItem {
    variant_id: number;
    product_name: string;
    attribute_values: string[] | null;
    sku: string | null;
    price: number;
    quantity: number;
    warehouse_id: number;
    warehouse_name: string;
    max_stock: number;
    stock_by_warehouse: Record<number, number>;
}


interface SaleHistoryItem {
    id: number;
    sale_number: string;
    total: number;
    payment_method: string;
    customer_name: string | null;
    status: string;
    created_at: string;
    items_count: number;
    has_exchanges: boolean;
    items: {
        id: number;
        quantity: number;
        unit_price: number;
        subtotal: number;
        variant: {
            id: number;
            sku: string | null;
            attribute_values: string[] | null;
            product_name: string;
        };
        warehouse: { id: number; name: string } | null;
    }[];
}

interface ExchangeMovement {
    id: number;
    movement_type: string;
    quantity: number;
    notes: string | null;
    created_at: string;
    variant: {
        id: number;
        sku: string | null;
        attribute_values: string[] | null;
        product_name: string;
    };
    warehouse: { id: number; name: string } | null;
}

interface ExchangeHistoryData {
    reference: string;
    sale_number: string;
    returned_items: ExchangeMovement[];
    new_items: ExchangeMovement[];
    date: string | null;
    notes: string | null;
}

const PAYMENT_METHODS = [
    { value: "efectivo", label: "Efectivo", icon: Banknote },
    { value: "tarjeta", label: "Tarjeta", icon: CreditCard },
    { value: "transferencia", label: "Transferencia", icon: ArrowLeftRight },
    { value: "otro", label: "Otro", icon: DollarSign },
];

const PAYMENT_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    otro: "Otro",
};

// ─── Page Component ──────────────────────────────────────

export default function POSPage() {
    // ── View state ──
    const [activeTab, setActiveTab] = useState<"sale" | "history">("sale");

    // ── Search state ──
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // ── Cart state ──
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState("efectivo");
    const [customerName, setCustomerName] = useState("");
    const [saleNotes, setSaleNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [saleError, setSaleError] = useState("");
    const [saleSuccess, setSaleSuccess] = useState("");

    // ── History state ──
    const [sales, setSales] = useState<SaleHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState("");
    const [historyDateFrom, setHistoryDateFrom] = useState("");
    const [historyDateTo, setHistoryDateTo] = useState("");
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPagination, setHistoryPagination] = useState<{
        page: number; limit: number; total: number; totalPages: number;
    } | null>(null);
    const [expandedSale, setExpandedSale] = useState<number | null>(null);

    // ── Exchange state ──
    const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
    const [exchangeSale, setExchangeSale] = useState<SaleHistoryItem | null>(null);
    const [exchangeStep, setExchangeStep] = useState<1 | 2>(1);
    const [exchangeReturns, setExchangeReturns] = useState<Record<number, number>>({}); // sale_item_id -> qty
    const [exchangeNewItems, setExchangeNewItems] = useState<{
        variant_id: number;
        product_name: string;
        attribute_values: string[] | null;
        sku: string | null;
        price: number;
        warehouse_id: number;
        warehouse_name: string;
        quantity: number;
        max_stock: number;
        stock_by_warehouse: Record<number, number>;
    }[]>([]);
    const [exchangeNewSearch, setExchangeNewSearch] = useState("");
    const [exchangeNewResults, setExchangeNewResults] = useState<SearchResult[]>([]);
    const [exchangeNewSearching, setExchangeNewSearching] = useState(false);
    const [exchangeNotes, setExchangeNotes] = useState("");
    const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
    const [exchangeError, setExchangeError] = useState("");
    const [exchangeSuccess, setExchangeSuccess] = useState("");
    const exchangeSearchTimeout = useRef<NodeJS.Timeout | null>(null);

    // ── Price override state ──
    const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
    const [editPriceValue, setEditPriceValue] = useState("");
    const priceInputRef = useRef<HTMLInputElement>(null);

    // ── Payment discounts state ──
    const [paymentDiscounts, setPaymentDiscounts] = useState<Record<string, { enabled: boolean; percentage: number }>>({});

    // ── Exchange history state ──
    const [exchangeHistoryOpen, setExchangeHistoryOpen] = useState(false);
    const [exchangeHistoryData, setExchangeHistoryData] = useState<ExchangeHistoryData | null>(null);
    const [exchangeHistoryLoading, setExchangeHistoryLoading] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // ── Search products ──

    const doSearch = useCallback(async (q: string) => {
        setSearching(true);
        try {
            const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}`);
            if (!res.ok) return;
            const data = await res.json();
            setSearchResults(data.results || []);
            if (data.warehouses) setWarehouses(data.warehouses);
        } catch {
            // ignore
        } finally {
            setSearching(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        doSearch("");
        // Load payment discount rules
        fetch("/api/settings/payment-discounts")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.discounts) setPaymentDiscounts(data.discounts); })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => doSearch(searchQuery), 300);
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery, doSearch]);

    // ── Load history ──

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            if (historySearch) params.set("search", historySearch);
            if (historyDateFrom) params.set("from", historyDateFrom);
            if (historyDateTo) params.set("to", historyDateTo);
            params.set("page", historyPage.toString());
            params.set("limit", "15");

            const res = await fetch(`/api/pos/sales?${params}`);
            if (!res.ok) return;
            const data = await res.json();
            setSales(data.sales || []);
            setHistoryPagination(data.pagination || null);
        } catch {
            // ignore
        } finally {
            setHistoryLoading(false);
        }
    }, [historySearch, historyDateFrom, historyDateTo, historyPage]);

    useEffect(() => {
        if (activeTab === "history") loadHistory();
    }, [activeTab, loadHistory]);

    // ── Exchange handlers ──

    function openExchangeModal(sale: SaleHistoryItem) {
        setExchangeSale(sale);
        setExchangeStep(1);
        setExchangeReturns({});
        setExchangeNewItems([]);
        setExchangeNewSearch("");
        setExchangeNewResults([]);
        setExchangeNotes("");
        setExchangeError("");
        setExchangeModalOpen(true);
    }

    function closeExchangeModal() {
        setExchangeModalOpen(false);
        setExchangeSale(null);
    }

    function toggleReturnItem(saleItemId: number, maxQty: number) {
        setExchangeReturns((prev) => {
            const updated = { ...prev };
            if (updated[saleItemId]) {
                delete updated[saleItemId];
            } else {
                updated[saleItemId] = 1;
            }
            return updated;
        });
    }

    function setReturnQty(saleItemId: number, qty: number) {
        setExchangeReturns((prev) => ({ ...prev, [saleItemId]: qty }));
    }

    // Search products for exchange step 2
    const doExchangeSearch = useCallback(async (q: string) => {
        setExchangeNewSearching(true);
        try {
            const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}`);
            if (!res.ok) return;
            const data = await res.json();
            setExchangeNewResults(data.results || []);
            if (data.warehouses && warehouses.length === 0) setWarehouses(data.warehouses);
        } catch {
            // ignore
        } finally {
            setExchangeNewSearching(false);
        }
    }, [warehouses.length]);

    // Debounced search for exchange
    useEffect(() => {
        if (!exchangeModalOpen || exchangeStep !== 2) return;
        if (exchangeSearchTimeout.current) clearTimeout(exchangeSearchTimeout.current);
        exchangeSearchTimeout.current = setTimeout(() => doExchangeSearch(exchangeNewSearch), 300);
        return () => {
            if (exchangeSearchTimeout.current) clearTimeout(exchangeSearchTimeout.current);
        };
    }, [exchangeNewSearch, exchangeModalOpen, exchangeStep, doExchangeSearch]);

    // Load initial results when entering step 2
    useEffect(() => {
        if (exchangeModalOpen && exchangeStep === 2 && exchangeNewResults.length === 0) {
            doExchangeSearch("");
        }
    }, [exchangeStep, exchangeModalOpen, doExchangeSearch, exchangeNewResults.length]);

    function addExchangeNewItem(result: SearchResult) {
        const sortedWarehouses = [...warehouses].sort((a, b) => a.sort_order - b.sort_order);
        let selectedWh: WarehouseRef | null = null;
        for (const wh of sortedWarehouses) {
            if ((result.stock_by_warehouse[wh.id] || 0) > 0) {
                selectedWh = wh;
                break;
            }
        }
        if (!selectedWh) {
            setExchangeError("Sin stock disponible para este producto");
            return;
        }

        const existingIdx = exchangeNewItems.findIndex(
            (i) => i.variant_id === result.variant_id && i.warehouse_id === selectedWh!.id
        );
        if (existingIdx >= 0) {
            const updated = [...exchangeNewItems];
            if (updated[existingIdx].quantity < updated[existingIdx].max_stock) {
                updated[existingIdx].quantity += 1;
                setExchangeNewItems(updated);
            }
        } else {
            setExchangeNewItems([
                ...exchangeNewItems,
                {
                    variant_id: result.variant_id,
                    product_name: result.product_name,
                    attribute_values: result.attribute_values,
                    sku: result.sku,
                    price: result.price,
                    warehouse_id: selectedWh.id,
                    warehouse_name: selectedWh.name,
                    quantity: 1,
                    max_stock: result.stock_by_warehouse[selectedWh.id] || 0,
                    stock_by_warehouse: result.stock_by_warehouse,
                },
            ]);
        }
        setExchangeError("");
    }

    function removeExchangeNewItem(index: number) {
        setExchangeNewItems(exchangeNewItems.filter((_, i) => i !== index));
    }

    function updateExchangeNewItemQty(index: number, delta: number) {
        const updated = [...exchangeNewItems];
        const newQty = updated[index].quantity + delta;
        if (newQty >= 1 && newQty <= updated[index].max_stock) {
            updated[index].quantity = newQty;
            setExchangeNewItems(updated);
        }
    }

    async function handleExchangeSubmit() {
        if (!exchangeSale) return;
        setExchangeError("");
        setExchangeSubmitting(true);

        const returnedItems = Object.entries(exchangeReturns).map(([saleItemIdStr, qty]) => {
            const saleItemId = parseInt(saleItemIdStr);
            const saleItem = exchangeSale.items.find((i) => i.id === saleItemId);
            return {
                sale_item_id: saleItemId,
                variant_id: saleItem!.variant.id,
                warehouse_id: saleItem!.warehouse?.id || 0,
                quantity: qty,
            };
        });

        const newItems = exchangeNewItems.map((item) => ({
            variant_id: item.variant_id,
            warehouse_id: item.warehouse_id,
            quantity: item.quantity,
            unit_price: item.price,
        }));

        try {
            const res = await fetch("/api/pos/exchange", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sale_id: exchangeSale.id,
                    returned_items: returnedItems,
                    new_items: newItems,
                    notes: exchangeNotes || undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al procesar el cambio");
            }

            const data = await res.json();
            closeExchangeModal();
            setExchangeSuccess(`Cambio registrado: ${data.exchange_ref}`);
            setTimeout(() => setExchangeSuccess(""), 5000);
            // Refresh search results and history to reflect new stock
            doSearch(searchQuery);
            loadHistory();
        } catch (err) {
            setExchangeError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setExchangeSubmitting(false);
        }
    }

    const hasSelectedReturns = Object.keys(exchangeReturns).length > 0;

    // ── Exchange history ──

    async function fetchExchangeHistory(saleNumber: string) {
        setExchangeHistoryLoading(true);
        setExchangeHistoryOpen(true);
        try {
            const res = await fetch(`/api/pos/exchanges?sale_number=${encodeURIComponent(saleNumber)}`);
            if (!res.ok) return;
            const data = await res.json();
            setExchangeHistoryData(data);
        } catch {
            // ignore
        } finally {
            setExchangeHistoryLoading(false);
        }
    }

    function closeExchangeHistory() {
        setExchangeHistoryOpen(false);
        setExchangeHistoryData(null);
    }

    // ── Cart operations ──

    function addToCart(result: SearchResult) {
        // Find first warehouse with stock (by sort_order)
        const sortedWarehouses = warehouses.sort((a, b) => a.sort_order - b.sort_order);
        let selectedWh: WarehouseRef | null = null;

        for (const wh of sortedWarehouses) {
            if ((result.stock_by_warehouse[wh.id] || 0) > 0) {
                selectedWh = wh;
                break;
            }
        }

        if (!selectedWh) {
            setSaleError("Sin stock disponible para este producto");
            setTimeout(() => setSaleError(""), 3000);
            return;
        }

        const existingIdx = cart.findIndex(
            (c) => c.variant_id === result.variant_id && c.warehouse_id === selectedWh!.id
        );

        if (existingIdx >= 0) {
            // Increment quantity
            const updated = [...cart];
            if (updated[existingIdx].quantity < updated[existingIdx].max_stock) {
                updated[existingIdx].quantity += 1;
                setCart(updated);
            } else {
                setSaleError("Stock insuficiente en el depósito origen para sumar otra unidad");
                setTimeout(() => setSaleError(""), 3000);
            }
        } else {
            setCart([
                ...cart,
                {
                    variant_id: result.variant_id,
                    product_name: result.product_name,
                    attribute_values: result.attribute_values,
                    sku: result.sku,
                    price: result.price,
                    quantity: 1,
                    warehouse_id: selectedWh.id,
                    warehouse_name: selectedWh.name,
                    max_stock: result.stock_by_warehouse[selectedWh.id] || 0,
                    stock_by_warehouse: result.stock_by_warehouse,
                },
            ]);
        }

        // Clear search after adding (if it was a specific search)
        if (searchQuery) {
            setSearchQuery("");
        }
        // Always focus back on input
        searchInputRef.current?.focus();
    }

    function changeCartItemWarehouse(index: number, newWarehouseId: number) {
        const updated = [...cart];
        const item = updated[index];
        const newWarehouse = warehouses.find(w => w.id === newWarehouseId);
        if (!newWarehouse) return;

        const newMaxStock = item.stock_by_warehouse[newWarehouseId] || 0;
        if (newMaxStock <= 0) return;

        item.warehouse_id = newWarehouseId;
        item.warehouse_name = newWarehouse.name;
        item.max_stock = newMaxStock;
        item.quantity = Math.min(item.quantity, newMaxStock);

        // Merge if identical variant exists with same warehouse
        const existingIdx = updated.findIndex(
            (c, i) => i !== index && c.variant_id === item.variant_id && c.warehouse_id === newWarehouseId
        );

        if (existingIdx >= 0) {
            const existingItem = updated[existingIdx];
            existingItem.quantity = Math.min(existingItem.quantity + item.quantity, existingItem.max_stock);
            updated.splice(index, 1);
        }

        setCart(updated);
    }

    function updateQuantity(index: number, delta: number) {
        const updated = [...cart];
        const newQty = updated[index].quantity + delta;
        if (newQty >= 1 && newQty <= updated[index].max_stock) {
            updated[index].quantity = newQty;
            setCart(updated);
        }
    }

    function removeFromCart(index: number) {
        setCart(cart.filter((_, i) => i !== index));
    }

    function startEditPrice(index: number) {
        setEditingPriceIdx(index);
        setEditPriceValue(cart[index].price.toString());
        setTimeout(() => priceInputRef.current?.select(), 50);
    }

    function saveCartPrice() {
        if (editingPriceIdx === null) return;
        const numVal = parseFloat(editPriceValue);
        if (!isNaN(numVal) && numVal >= 0) {
            const updated = [...cart];
            updated[editingPriceIdx].price = numVal;
            setCart(updated);
        }
        setEditingPriceIdx(null);
    }

    function handlePriceKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") { e.preventDefault(); saveCartPrice(); }
        else if (e.key === "Escape") setEditingPriceIdx(null);
    }

    function clearCart() {
        setCart([]);
        setPaymentMethod("efectivo");
        setCustomerName("");
        setSaleNotes("");
        setSaleError("");
    }

    // ── Submit sale ──

    async function handleConfirmSale() {
        if (cart.length === 0) return;

        setSaleError("");
        setSubmitting(true);

        try {
            const res = await fetch("/api/pos/sale", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: cart.map((item) => ({
                        variant_id: item.variant_id,
                        warehouse_id: item.warehouse_id,
                        quantity: item.quantity,
                        unit_price: item.price,
                    })),
                    payment_method: paymentMethod,
                    customer_name: customerName || undefined,
                    notes: saleNotes || undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al procesar la venta");
            }

            const data = await res.json();
            setSaleSuccess(`Venta ${data.sale.sale_number} registrada correctamente`);
            clearCart();
            setTimeout(() => setSaleSuccess(""), 5000);
        } catch (err) {
            setSaleError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSubmitting(false);
        }
    }

    // ── Formatting helpers ──

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const activeDiscount = paymentDiscounts[paymentMethod];
    const discountPct = activeDiscount?.enabled ? activeDiscount.percentage : 0;
    const discountAmount = cartSubtotal * (discountPct / 100);
    const cartTotal = cartSubtotal - discountAmount;

    // ── Render ──

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <ShoppingCart size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Punto de Venta</h1>
                </div>
                <p className="page-subtitle">
                    Registrá ventas rápidas buscando productos por SKU, código de barras o nombre.
                </p>
            </div>

            {/* Tabs */}
            <div className="pos-tabs">
                <button
                    className={`pos-tab ${activeTab === "sale" ? "pos-tab-active" : ""}`}
                    onClick={() => setActiveTab("sale")}
                >
                    <Receipt size={16} strokeWidth={1.5} />
                    Nueva Venta
                </button>
                <button
                    className={`pos-tab ${activeTab === "history" ? "pos-tab-active" : ""}`}
                    onClick={() => setActiveTab("history")}
                >
                    <Clock size={16} strokeWidth={1.5} />
                    Historial
                </button>
            </div>

            {/* ═══ SALE VIEW ═══ */}
            {activeTab === "sale" && (
                <div className="pos-sale-layout">
                    {/* ── Left: Search & Results ── */}
                    <div className="pos-search-panel">
                        {/* Success toast */}
                        {saleSuccess && (
                            <div className="pos-toast pos-toast-success">
                                <CheckCircle2 size={18} strokeWidth={1.5} />
                                <span>{saleSuccess}</span>
                                <button onClick={() => setSaleSuccess("")} className="pos-toast-close">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Error toast */}
                        {saleError && (
                            <div className="pos-toast pos-toast-error">
                                <span>{saleError}</span>
                                <button onClick={() => setSaleError("")} className="pos-toast-close">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Search bar */}
                        <div className="pos-search-bar">
                            <ScanBarcode size={20} strokeWidth={1.5} className="pos-search-icon" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="pos-search-input"
                                placeholder="Ingresar código o buscar producto..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    className="pos-search-clear"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSearchResults([]);
                                        searchInputRef.current?.focus();
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Search results */}
                        {searching && (
                            <div className="pos-search-loading">
                                <Loader2 size={20} className="spin" />
                                <span>Buscando...</span>
                            </div>
                        )}

                        {!searching && searchResults.length > 0 && (
                            <div className="pos-results">
                                {searchResults.map((r) => (
                                    <button
                                        key={r.variant_id}
                                        className="pos-result-card"
                                        onClick={() => addToCart(r)}
                                    >
                                        <div className="pos-result-info">
                                            <span className="pos-result-name">{r.product_name}</span>
                                            <span className="pos-result-detail">
                                                {r.attribute_values?.join(" / ") || ""}
                                                {r.sku ? ` · ${r.sku}` : ""}
                                            </span>
                                        </div>
                                        <div className="pos-result-right">
                                            <span className="pos-result-price">
                                                {formatCurrency(r.price)}
                                            </span>
                                            <span className={`pos-result-stock ${r.total_stock <= 0 ? "pos-stock-zero" : r.total_stock <= 5 ? "pos-stock-low" : ""}`}>
                                                {r.total_stock} uds.
                                            </span>
                                        </div>
                                        <Plus size={18} strokeWidth={2} className="pos-result-add" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {!searching && searchQuery && searchResults.length === 0 && (
                            <div className="pos-no-results">
                                <PackageOpen size={40} strokeWidth={1} />
                                <p>No se encontraron productos</p>
                            </div>
                        )}

                    </div>

                    {/* ── Right: Cart ── */}
                    <div className="pos-cart-panel">
                        <div className="pos-cart-header">
                            <h2 className="pos-cart-title">
                                <ShoppingCart size={18} strokeWidth={1.5} />
                                Carrito
                                {cartItemsCount > 0 && (
                                    <span className="pos-cart-badge">{cartItemsCount}</span>
                                )}
                            </h2>
                            {cart.length > 0 && (
                                <button className="pos-cart-clear" onClick={clearCart}>
                                    Vaciar
                                </button>
                            )}
                        </div>

                        {cart.length === 0 ? (
                            <div className="pos-cart-empty">
                                <PackageOpen size={32} strokeWidth={1} />
                                <p>El carrito está vacío</p>
                            </div>
                        ) : (
                            <>
                                {/* Cart items */}
                                <div className="pos-cart-items">
                                    {cart.map((item, index) => (
                                        <div key={`${item.variant_id}-${item.warehouse_id}`} className="pos-cart-item">
                                            <div className="pos-cart-item-info">
                                                <span className="pos-cart-item-name">{item.product_name}</span>
                                                <span className="pos-cart-item-detail">
                                                    {item.attribute_values?.join(" / ") || ""}
                                                    {item.sku ? ` · ${item.sku}` : ""}
                                                </span>
                                            </div>
                                            <div className="pos-cart-item-controls">
                                                <div className="pos-qty-controls">
                                                    <button
                                                        className="pos-qty-btn"
                                                        onClick={() => updateQuantity(index, -1)}
                                                        disabled={item.quantity <= 1}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="pos-qty-value">{item.quantity}</span>
                                                    <button
                                                        className="pos-qty-btn"
                                                        onClick={() => updateQuantity(index, 1)}
                                                        disabled={item.quantity >= item.max_stock}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                {editingPriceIdx === index ? (
                                                    <div className="pos-price-edit">
                                                        <span className="pos-price-edit-prefix">$</span>
                                                        <input
                                                            ref={priceInputRef}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            className="pos-price-edit-input"
                                                            value={editPriceValue}
                                                            onChange={(e) => setEditPriceValue(e.target.value)}
                                                            onKeyDown={handlePriceKeyDown}
                                                            onBlur={saveCartPrice}
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <span
                                                        className="pos-cart-item-price pos-cart-item-price-editable"
                                                        onClick={() => startEditPrice(index)}
                                                        title="Click para editar precio"
                                                    >
                                                        {formatCurrency(item.price * item.quantity)}
                                                        <Pencil size={10} className="pos-price-edit-icon" />
                                                    </span>
                                                )}
                                                <button
                                                    className="pos-cart-item-remove"
                                                    onClick={() => removeFromCart(index)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="pos-cart-warehouse-select-wrapper">
                                                <select
                                                    className="pos-cart-warehouse-select"
                                                    value={item.warehouse_id}
                                                    onChange={(e) => changeCartItemWarehouse(index, parseInt(e.target.value))}
                                                >
                                                    {warehouses.map(wh => (
                                                        <option
                                                            key={wh.id}
                                                            value={wh.id}
                                                            disabled={(item.stock_by_warehouse[wh.id] || 0) <= 0}
                                                        >
                                                            {wh.name} (Stock: {item.stock_by_warehouse[wh.id] || 0})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Payment method */}
                                <div className="pos-payment-section">
                                    <label className="pos-section-label">Medio de pago</label>
                                    <div className="pos-payment-grid">
                                        {PAYMENT_METHODS.map((pm) => {
                                            const disc = paymentDiscounts[pm.value];
                                            const hasDsc = disc?.enabled && disc.percentage > 0;
                                            return (
                                                <button
                                                    key={pm.value}
                                                    type="button"
                                                    className={`pos-payment-option ${paymentMethod === pm.value ? "pos-payment-active" : ""}`}
                                                    onClick={() => setPaymentMethod(pm.value)}
                                                >
                                                    <pm.icon size={16} strokeWidth={1.5} />
                                                    <span>{pm.label}</span>
                                                    {hasDsc && (
                                                        <span className="pos-payment-discount-badge">-{disc.percentage}%</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Customer (optional) */}
                                <div className="pos-customer-section">
                                    <label className="pos-section-label">
                                        <User size={14} strokeWidth={1.5} />
                                        Cliente <span className="pos-optional">(opcional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="pos-customer-input"
                                        placeholder="Nombre del cliente..."
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>

                                {/* Total + Confirm */}
                                <div className="pos-cart-footer">
                                    {discountPct > 0 && (
                                        <div className="pos-cart-breakdown">
                                            <div className="pos-cart-breakdown-row">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(cartSubtotal)}</span>
                                            </div>
                                            <div className="pos-cart-breakdown-row pos-cart-breakdown-discount">
                                                <span>Dto. {PAYMENT_LABELS[paymentMethod]} (-{discountPct}%)</span>
                                                <span>-{formatCurrency(discountAmount)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="pos-cart-total">
                                        <span>Total</span>
                                        <span className="pos-cart-total-amount">
                                            {formatCurrency(cartTotal)}
                                        </span>
                                    </div>
                                    <button
                                        className="pos-confirm-btn"
                                        onClick={handleConfirmSale}
                                        disabled={submitting || cart.length === 0}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={18} className="spin" />
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} strokeWidth={1.5} />
                                                Confirmar Venta
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ HISTORY VIEW ═══ */}
            {activeTab === "history" && (
                <div className="pos-history">
                    {/* Filters */}
                    <div className="pos-history-filters">
                        <div className="stock-search-wrapper">
                            <Search size={16} strokeWidth={1.5} className="stock-search-icon" />
                            <input
                                type="text"
                                className="stock-search-input"
                                placeholder="Buscar por nro. o cliente..."
                                value={historySearch}
                                onChange={(e) => {
                                    setHistorySearch(e.target.value);
                                    setHistoryPage(1);
                                }}
                            />
                            {historySearch && (
                                <button
                                    className="stock-search-clear"
                                    onClick={() => { setHistorySearch(""); setHistoryPage(1); }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="mv-date-wrapper">
                            <Calendar size={16} strokeWidth={1.5} className="mv-date-icon" />
                            <input
                                type="date"
                                className="mv-date-input"
                                value={historyDateFrom}
                                onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                            />
                            <span className="mv-date-sep">—</span>
                            <input
                                type="date"
                                className="mv-date-input"
                                value={historyDateTo}
                                onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                            />
                        </div>
                    </div>

                    {/* Loading */}
                    {historyLoading && (
                        <div className="wh-loading">
                            <Loader2 size={24} className="spin" />
                        </div>
                    )}

                    {/* Empty */}
                    {!historyLoading && sales.length === 0 && (
                        <div className="wh-empty">
                            <Receipt size={48} strokeWidth={1} />
                            <h2>No hay ventas registradas</h2>
                            <p>Las ventas que realices aparecerán aquí.</p>
                        </div>
                    )}

                    {/* Sales table */}
                    {!historyLoading && sales.length > 0 && (
                        <>
                            <div className="stock-table-container">
                                <table className="stock-table">
                                    <thead>
                                        <tr>
                                            <th className="stock-th"></th>
                                            <th className="stock-th">Nro. Venta</th>
                                            <th className="stock-th">Fecha</th>
                                            <th className="stock-th">Items</th>
                                            <th className="stock-th">Medio de Pago</th>
                                            <th className="stock-th">Cliente</th>
                                            <th className="stock-th pos-th-total">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.map((sale) => (
                                            <Fragment key={sale.id}>
                                                <tr
                                                    className={`stock-row pos-sale-row ${expandedSale === sale.id ? "pos-sale-expanded" : ""}`}
                                                    onClick={() =>
                                                        setExpandedSale(expandedSale === sale.id ? null : sale.id)
                                                    }
                                                >
                                                    <td className="stock-td pos-td-expand">
                                                        {expandedSale === sale.id ? (
                                                            <ChevronUp size={16} />
                                                        ) : (
                                                            <ChevronDown size={16} />
                                                        )}
                                                    </td>
                                                    <td className="stock-td">
                                                        <div className="pos-sale-number-cell">
                                                            <span className="pos-sale-number">{sale.sale_number}</span>
                                                            {sale.has_exchanges && (
                                                                <button
                                                                    className="pos-exchange-badge"
                                                                    title="Ver historial de cambios"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        fetchExchangeHistory(sale.sale_number);
                                                                    }}
                                                                >
                                                                    <RefreshCw size={12} strokeWidth={2} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="stock-td">
                                                        <span className="mv-date-primary">{formatDate(sale.created_at)}</span>
                                                        <span className="mv-date-secondary">{formatTime(sale.created_at)}</span>
                                                    </td>
                                                    <td className="stock-td">
                                                        <span className="pos-items-count">{sale.items_count} prod.</span>
                                                    </td>
                                                    <td className="stock-td">
                                                        <span className="pos-payment-badge">
                                                            {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className="stock-td">
                                                        <span className="pos-customer-text">
                                                            {sale.customer_name || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="stock-td pos-td-total">
                                                        <span className="pos-total-amount">
                                                            {formatCurrency(sale.total)}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {expandedSale === sale.id && (
                                                    <tr key={`${sale.id}-detail`} className="pos-detail-row">
                                                        <td colSpan={7}>
                                                            <div className="pos-detail-content">
                                                                <table className="pos-detail-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Producto</th>
                                                                            <th>Variante</th>
                                                                            <th>Depósito</th>
                                                                            <th>Cant.</th>
                                                                            <th>Precio</th>
                                                                            <th>Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {sale.items.map((item) => (
                                                                            <tr key={item.id}>
                                                                                <td>{item.variant.product_name}</td>
                                                                                <td>
                                                                                    {item.variant.attribute_values?.join(" / ") || "—"}
                                                                                    {item.variant.sku ? (
                                                                                        <span className="mv-sku-text"> {item.variant.sku}</span>
                                                                                    ) : null}
                                                                                </td>
                                                                                <td>{item.warehouse?.name || "—"}</td>
                                                                                <td>{item.quantity}</td>
                                                                                <td>{formatCurrency(item.unit_price)}</td>
                                                                                <td>{formatCurrency(item.subtotal)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                                <button
                                                                    className="pos-exchange-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openExchangeModal(sale);
                                                                    }}
                                                                >
                                                                    <RefreshCw size={14} strokeWidth={2} />
                                                                    Registrar Cambio
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {historyPagination && historyPagination.totalPages > 1 && (
                                <div className="mv-pagination">
                                    <span className="mv-pagination-info">
                                        Mostrando{" "}
                                        {(historyPagination.page - 1) * historyPagination.limit + 1}–
                                        {Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)}{" "}
                                        de {historyPagination.total}
                                    </span>
                                    <div className="mv-pagination-buttons">
                                        <button
                                            className="mv-pagination-btn"
                                            disabled={historyPage <= 1}
                                            onClick={() => setHistoryPage((p) => p - 1)}
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="mv-pagination-current">
                                            {historyPagination.page} / {historyPagination.totalPages}
                                        </span>
                                        <button
                                            className="mv-pagination-btn"
                                            disabled={historyPage >= historyPagination.totalPages}
                                            onClick={() => setHistoryPage((p) => p + 1)}
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ═══ EXCHANGE SUCCESS TOAST ═══ */}
            {exchangeSuccess && (
                <div className="pos-toast pos-toast-success" style={{ position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 60 }}>
                    <CheckCircle2 size={18} strokeWidth={1.5} />
                    <span>{exchangeSuccess}</span>
                    <button onClick={() => setExchangeSuccess("")} className="pos-toast-close">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ═══ EXCHANGE MODAL ═══ */}
            {exchangeModalOpen && exchangeSale && (
                <div className="exchange-modal-overlay" onClick={closeExchangeModal}>
                    <div className="exchange-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="exchange-modal-header">
                            <h2 className="exchange-modal-title">
                                <RefreshCw size={20} strokeWidth={2} />
                                Cambio
                                <span className="exchange-ref-badge">{exchangeSale.sale_number}</span>
                            </h2>
                            <button className="exchange-modal-close" onClick={closeExchangeModal}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Stepper */}
                        <div className="exchange-stepper">
                            <div className={`exchange-step ${exchangeStep === 1 ? "exchange-step-active" : exchangeStep > 1 ? "exchange-step-done" : ""}`}>
                                <span className="exchange-step-number">{exchangeStep > 1 ? <Check size={12} /> : "1"}</span>
                                <span className="exchange-step-label">Devuelve</span>
                            </div>
                            <div className="exchange-step-divider" />
                            <div className={`exchange-step ${exchangeStep === 2 ? "exchange-step-active" : ""}`}>
                                <span className="exchange-step-number">2</span>
                                <span className="exchange-step-label">Lleva</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="exchange-body">
                            {exchangeError && (
                                <div className="exchange-error">{exchangeError}</div>
                            )}

                            {/* ── STEP 1: Select returns ── */}
                            {exchangeStep === 1 && (
                                <>
                                    <p className="exchange-section-title">¿Qué productos devuelve la clienta?</p>
                                    <p className="exchange-section-subtitle">Seleccioná los items y la cantidad a devolver</p>
                                    <div className="exchange-return-list">
                                        {exchangeSale.items.map((item) => {
                                            const isSelected = exchangeReturns[item.id] !== undefined;
                                            const selectedQty = exchangeReturns[item.id] || 1;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`exchange-return-item ${isSelected ? "exchange-return-item-selected" : ""}`}
                                                >
                                                    <div
                                                        className={`exchange-return-checkbox ${isSelected ? "exchange-return-checkbox-checked" : ""}`}
                                                        onClick={() => toggleReturnItem(item.id, item.quantity)}
                                                    >
                                                        {isSelected && <Check size={12} />}
                                                    </div>
                                                    <div className="exchange-return-info">
                                                        <span className="exchange-return-name">{item.variant.product_name}</span>
                                                        <span className="exchange-return-detail">
                                                            {item.variant.attribute_values?.join(" / ") || ""}
                                                            {item.variant.sku ? ` · ${item.variant.sku}` : ""}
                                                            {item.warehouse ? ` · ${item.warehouse.name}` : ""}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="exchange-return-qty">
                                                            <span className="exchange-return-qty-label">Cant:</span>
                                                            <select
                                                                value={selectedQty}
                                                                onChange={(e) => setReturnQty(item.id, parseInt(e.target.value))}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                                                                    <option key={n} value={n}>{n}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* ── STEP 2: Select new items ── */}
                            {exchangeStep === 2 && (
                                <>
                                    <p className="exchange-section-title">¿Qué productos lleva a cambio?</p>
                                    <p className="exchange-section-subtitle">Buscá y seleccioná los nuevos productos</p>

                                    {/* Selected new items */}
                                    {exchangeNewItems.length > 0 && (
                                        <div className="exchange-new-items">
                                            <div className="exchange-new-items-title">Productos nuevos seleccionados</div>
                                            {exchangeNewItems.map((item, index) => (
                                                <div key={`${item.variant_id}-${item.warehouse_id}`} className="exchange-new-item">
                                                    <div className="exchange-new-item-info">
                                                        <span className="exchange-new-item-name">{item.product_name}</span>
                                                        <span className="exchange-new-item-detail">
                                                            {item.attribute_values?.join(" / ") || ""}
                                                            {item.sku ? ` · ${item.sku}` : ""}
                                                            {` · ${item.warehouse_name}`}
                                                        </span>
                                                    </div>
                                                    <div className="pos-qty-controls">
                                                        <button
                                                            className="pos-qty-btn"
                                                            onClick={() => updateExchangeNewItemQty(index, -1)}
                                                            disabled={item.quantity <= 1}
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="pos-qty-value">{item.quantity}</span>
                                                        <button
                                                            className="pos-qty-btn"
                                                            onClick={() => updateExchangeNewItemQty(index, 1)}
                                                            disabled={item.quantity >= item.max_stock}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                    <button className="exchange-new-item-remove" onClick={() => removeExchangeNewItem(index)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Search */}
                                    <div className="exchange-new-search">
                                        <Search size={16} className="exchange-new-search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Buscar producto por nombre, SKU o código..."
                                            value={exchangeNewSearch}
                                            onChange={(e) => setExchangeNewSearch(e.target.value)}
                                        />
                                    </div>

                                    {exchangeNewSearching && (
                                        <div className="exchange-loading">
                                            <Loader2 size={16} className="spin" />
                                            Buscando...
                                        </div>
                                    )}

                                    {!exchangeNewSearching && exchangeNewResults.length > 0 && (
                                        <div className="exchange-new-results">
                                            {exchangeNewResults.map((r) => (
                                                <button
                                                    key={r.variant_id}
                                                    className="exchange-new-result"
                                                    onClick={() => addExchangeNewItem(r)}
                                                >
                                                    <div className="exchange-new-result-info">
                                                        <span className="exchange-new-result-name">{r.product_name}</span>
                                                        <span className="exchange-new-result-detail">
                                                            {r.attribute_values?.join(" / ") || ""}
                                                            {r.sku ? ` · ${r.sku}` : ""}
                                                        </span>
                                                    </div>
                                                    <div className="exchange-new-result-right">
                                                        <span className="exchange-new-result-price">{formatCurrency(r.price)}</span>
                                                        <span className="exchange-new-result-stock">{r.total_stock} uds.</span>
                                                    </div>
                                                    <Plus size={16} strokeWidth={2} className="pos-result-add" style={{ opacity: 1 }} />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div className="exchange-notes">
                                        <label>Notas <span className="mv-optional">(opcional)</span></label>
                                        <textarea
                                            rows={2}
                                            placeholder="Motivo del cambio, observaciones..."
                                            value={exchangeNotes}
                                            onChange={(e) => setExchangeNotes(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="exchange-footer">
                            <div className="exchange-footer-left">
                                {exchangeStep === 2 && (
                                    <button className="exchange-btn" onClick={() => setExchangeStep(1)} disabled={exchangeSubmitting}>
                                        <ChevronLeft size={14} />
                                        Atrás
                                    </button>
                                )}
                            </div>
                            <div className="exchange-footer-actions">
                                <button className="exchange-btn" onClick={closeExchangeModal} disabled={exchangeSubmitting}>
                                    Cancelar
                                </button>
                                {exchangeStep === 1 && (
                                    <button
                                        className="exchange-btn exchange-btn-primary"
                                        onClick={() => {
                                            if (!hasSelectedReturns) {
                                                setExchangeError("Seleccioná al menos un producto a devolver");
                                                return;
                                            }
                                            setExchangeError("");
                                            setExchangeStep(2);
                                        }}
                                    >
                                        Siguiente
                                        <ChevronRight size={14} />
                                    </button>
                                )}
                                {exchangeStep === 2 && (
                                    <button
                                        className="exchange-btn exchange-btn-primary"
                                        onClick={handleExchangeSubmit}
                                        disabled={exchangeSubmitting || exchangeNewItems.length === 0}
                                    >
                                        {exchangeSubmitting ? (
                                            <>
                                                <Loader2 size={14} className="spin" />
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={14} />
                                                Confirmar Cambio
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ EXCHANGE HISTORY MODAL ═══ */}
            {exchangeHistoryOpen && (
                <div className="exchange-modal-overlay" onClick={closeExchangeHistory}>
                    <div className="exchange-modal exchange-history-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="exchange-modal-header">
                            <h2 className="exchange-modal-title">
                                <RefreshCw size={20} strokeWidth={2} />
                                Historial de Cambios
                                {exchangeHistoryData && (
                                    <span className="exchange-ref-badge">{exchangeHistoryData.sale_number}</span>
                                )}
                            </h2>
                            <button className="exchange-modal-close" onClick={closeExchangeHistory}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="exchange-body">
                            {exchangeHistoryLoading && (
                                <div className="exchange-loading">
                                    <Loader2 size={20} className="spin" />
                                    Cargando historial...
                                </div>
                            )}

                            {!exchangeHistoryLoading && exchangeHistoryData && (
                                <>
                                    {/* Date and notes */}
                                    <div className="exchange-history-meta">
                                        {exchangeHistoryData.date && (
                                            <span className="exchange-history-date">
                                                <Calendar size={14} strokeWidth={1.5} />
                                                {formatDate(exchangeHistoryData.date)} {formatTime(exchangeHistoryData.date)}
                                            </span>
                                        )}
                                        {exchangeHistoryData.notes && (
                                            <span className="exchange-history-notes">{exchangeHistoryData.notes}</span>
                                        )}
                                    </div>

                                    <div className="exchange-history-timeline">
                                        {/* Returned items */}
                                        <div className="exchange-history-section exchange-history-returned">
                                            <h3 className="exchange-history-section-title">
                                                <span className="exchange-history-section-icon">
                                                    <ChevronLeft size={12} strokeWidth={2.5} />
                                                </span>
                                                Productos devueltos
                                            </h3>
                                            {exchangeHistoryData.returned_items.length === 0 ? (
                                                <p className="exchange-history-empty">Sin productos devueltos</p>
                                            ) : (
                                                <div className="exchange-history-items">
                                                    {exchangeHistoryData.returned_items.map((item) => (
                                                        <div key={item.id} className="exchange-history-item">
                                                            <div className="exchange-history-item-info">
                                                                <span className="exchange-history-item-name">
                                                                    {item.variant.product_name}
                                                                </span>
                                                                <div className="exchange-history-item-detail">
                                                                    {item.variant.attribute_values && item.variant.attribute_values.length > 0 && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.variant.attribute_values.join(" / ")}
                                                                        </span>
                                                                    )}
                                                                    {item.variant.sku && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.variant.sku}
                                                                        </span>
                                                                    )}
                                                                    {item.warehouse && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.warehouse.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="exchange-history-item-qty">×{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Flow arrow separator */}
                                        <div className="exchange-history-flow">
                                            <div className="exchange-history-flow-line" />
                                            <div className="exchange-history-flow-icon">
                                                <RefreshCw size={14} strokeWidth={2} />
                                            </div>
                                        </div>

                                        {/* New items */}
                                        <div className="exchange-history-section exchange-history-new">
                                            <h3 className="exchange-history-section-title">
                                                <span className="exchange-history-section-icon">
                                                    <ChevronRight size={12} strokeWidth={2.5} />
                                                </span>
                                                Productos nuevos
                                            </h3>
                                            {exchangeHistoryData.new_items.length === 0 ? (
                                                <p className="exchange-history-empty">Sin productos nuevos</p>
                                            ) : (
                                                <div className="exchange-history-items">
                                                    {exchangeHistoryData.new_items.map((item) => (
                                                        <div key={item.id} className="exchange-history-item">
                                                            <div className="exchange-history-item-info">
                                                                <span className="exchange-history-item-name">
                                                                    {item.variant.product_name}
                                                                </span>
                                                                <div className="exchange-history-item-detail">
                                                                    {item.variant.attribute_values && item.variant.attribute_values.length > 0 && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.variant.attribute_values.join(" / ")}
                                                                        </span>
                                                                    )}
                                                                    {item.variant.sku && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.variant.sku}
                                                                        </span>
                                                                    )}
                                                                    {item.warehouse && (
                                                                        <span className="exchange-history-item-tag">
                                                                            {item.warehouse.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="exchange-history-item-qty">×{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="exchange-footer">
                            <div className="exchange-footer-left" />
                            <div className="exchange-footer-actions">
                                <button className="exchange-btn" onClick={closeExchangeHistory}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
