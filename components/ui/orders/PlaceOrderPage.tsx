"use client";

import { useCallback, useEffect, useState } from "react";

interface ProductLaunch {
  id: string;
  product_id: string;
  business_id: string;
  status: string;
  products: { title: string; description: string | null } | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  customer_name: string;
  line_items: Array<{ title: string; quantity: number; price: number }>;
  created_at: string;
}

interface PrintifyOrder {
  orderId: string;
  printifyId: string;
  label: string;
  status: string;
  total: number;
  currency: string;
  customerName: string;
  trackingNumber: string | null;
  carrier: string | null;
  itemCount: number;
  items: Array<{ title: string; quantity: number; variant: string }>;
  createdAt: string | null;
}

interface OrderForm {
  productLaunchId: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
}

function statusBadge(status: string) {
  if (status === "shipped" || status === "fulfilled" || status === "sent-to-production")
    return "bg-green-500/20 text-green-400";
  if (status === "delivered") return "bg-blue-500/20 text-blue-400";
  if (status === "cancelled" || status === "refunded") return "bg-red-500/20 text-red-400";
  return "bg-yellow-500/20 text-yellow-400";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function PlaceOrderPage({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<"printify" | "local">("printify");
  const [productLaunches, setProductLaunches] = useState<ProductLaunch[]>([]);
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [printifyOrders, setPrintifyOrders] = useState<PrintifyOrder[]>([]);
  const [printifyLoading, setPrintifyLoading] = useState(false);
  const [printifyError, setPrintifyError] = useState<string | null>(null);
  const [creatingTestOrder, setCreatingTestOrder] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState<OrderForm>({
    productLaunchId: "",
    customerName: "",
    customerEmail: "",
    quantity: 1,
  });

  const fetchLocalData = useCallback(async () => {
    setLoading(true);
    try {
      const [launchesRes, ordersRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/product-launches`),
        fetch(`/api/orders?businessId=${businessId}`),
      ]);
      if (launchesRes.ok) {
        const d = await launchesRes.json();
        setProductLaunches(d.launches || []);
      }
      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setLocalOrders(d.orders || []);
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const fetchPrintifyOrders = useCallback(async () => {
    setPrintifyLoading(true);
    setPrintifyError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/printify-orders?limit=30`);
      const data = await res.json();
      if (!res.ok) {
        setPrintifyError(data.error || "Failed to load Printify orders.");
        return;
      }
      setPrintifyOrders(data.orders || []);
    } catch {
      setPrintifyError("Network error loading Printify orders.");
    } finally {
      setPrintifyLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchLocalData();
  }, [fetchLocalData]);

  useEffect(() => {
    if (tab === "printify") fetchPrintifyOrders();
  }, [tab, fetchPrintifyOrders]);

  async function handleCreatePrintifyTestOrder() {
    setCreatingTestOrder(true);
    setCreateSuccess(null);
    setPrintifyError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/printify-orders`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setPrintifyError(data.error || "Failed to create test order.");
        return;
      }
      setCreateSuccess(data.orderId);
      await fetchPrintifyOrders();
    } catch {
      setPrintifyError("Network error creating test order.");
    } finally {
      setCreatingTestOrder(false);
    }
  }

  function handleCopy(orderId: string) {
    copyToClipboard(orderId);
    setCopied(orderId);
    setTimeout(() => setCopied(null), 1500);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLastOrderNumber(null);
    try {
      const selectedLaunch = productLaunches.find((l) => l.id === form.productLaunchId);
      const productTitle = selectedLaunch?.products?.title || "Sample Product";
      const lineItems = [{ title: productTitle, quantity: form.quantity, price: 29.9 }];

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          productLaunchId: form.productLaunchId || undefined,
          customerName: form.customerName || "Test Customer",
          customerEmail: form.customerEmail || "test@example.com",
          lineItems,
          totalAmount: 29.9 * form.quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to place order.");
        return;
      }
      setLastOrderNumber(data.order.order_number);
      setForm({ productLaunchId: "", customerName: "", customerEmail: "", quantity: 1 });
      await fetchLocalData();
    } catch {
      setError("Network error placing order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(["printify", "local"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "printify" ? "Printify Orders" : "Test Orders"}
          </button>
        ))}
      </div>

      {/* ── Printify Orders tab ──────────────────────────────────── */}
      {tab === "printify" && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Printify Orders</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Real orders from your Printify shop. Click an order ID to copy it — then paste it in the support chat.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreatePrintifyTestOrder}
                disabled={creatingTestOrder || printifyLoading}
                className="px-3 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
              >
                {creatingTestOrder ? "Creating..." : "+ Create Test Order"}
              </button>
              <button
                onClick={fetchPrintifyOrders}
                disabled={printifyLoading}
                className="px-3 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300"
              >
                {printifyLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {createSuccess && (
            <div className="mb-4 p-3 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              Test order created:{" "}
              <button onClick={() => handleCopy(createSuccess)} className="font-mono font-bold hover:underline">
                {createSuccess}
              </button>{" "}
              {copied === createSuccess ? "✓ copied" : "— click to copy, then use it in the support chat"}
            </div>
          )}

          {printifyError && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {printifyError}
            </div>
          )}

          {printifyLoading && !printifyOrders.length ? (
            <div className="text-sm text-gray-500">Loading from Printify...</div>
          ) : printifyOrders.length === 0 ? (
            <div className="text-sm text-gray-500">
              No orders yet — click <strong>+ Create Test Order</strong> to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-400">
                    <th className="pb-2 pr-4">Order ID <span className="text-gray-600">(click to copy)</span></th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2 pr-4">Tracking</th>
                    <th className="pb-2 pr-4">Items</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {printifyOrders.map((order) => (
                    <tr key={order.printifyId} className="border-b border-gray-800/50 hover:bg-gray-900/40">
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => handleCopy(order.orderId)}
                          title="Click to copy order ID"
                          className="font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 group"
                        >
                          {order.label}
                          <span className="text-gray-600 text-xs group-hover:text-gray-400">
                            {copied === order.orderId ? "✓ copied" : "⎘"}
                          </span>
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-gray-300">{order.customerName}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-300">
                        {order.currency} {order.total.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                        {order.trackingNumber
                          ? <button onClick={() => handleCopy(order.trackingNumber!)} className="hover:text-gray-200">{order.trackingNumber}</button>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                        {order.items[0]?.title && (
                          <span className="text-gray-600 ml-1">· {order.items[0].title}</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-500 text-xs">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Test Orders tab ──────────────────────────────────────── */}
      {tab === "local" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-base font-semibold mb-1">Place a Test Order</h2>
            <p className="text-xs text-gray-500 mb-4">Creates a local order you can test the support chat with.</p>

            {lastOrderNumber && (
              <div className="mb-4 p-3 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                Order created:{" "}
                <button
                  onClick={() => handleCopy(lastOrderNumber)}
                  className="font-mono font-bold hover:underline"
                >
                  {lastOrderNumber}
                </button>{" "}
                {copied === lastOrderNumber ? "✓ copied — " : "— "}
                paste this in the support chat.
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Product</label>
                <select
                  value={form.productLaunchId}
                  onChange={(e) => setForm((f) => ({ ...f, productLaunchId: e.target.value }))}
                  className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                >
                  <option value="">Quick order (placeholder product)</option>
                  {productLaunches.map((launch) => (
                    <option key={launch.id} value={launch.id}>
                      {launch.products?.title || "Unknown Product"} ({launch.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder="Test Customer"
                    className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                    placeholder="test@example.com"
                    className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-24 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium text-white"
              >
                {submitting ? "Placing..." : "Place Order (RM 29.90 each)"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4">Local Test Orders</h2>
            {localOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No test orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-xs text-gray-400">
                      <th className="pb-2 pr-4">Order #</th>
                      <th className="pb-2 pr-4">Customer</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Total</th>
                      <th className="pb-2 pr-4">Items</th>
                      <th className="pb-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-800/50">
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => handleCopy(order.order_number)}
                            className="font-mono text-blue-400 hover:text-blue-300"
                          >
                            {order.order_number}
                          </button>
                        </td>
                        <td className="py-2 pr-4">{order.customer_name}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">RM {Number(order.total_amount).toFixed(2)}</td>
                        <td className="py-2 pr-4">{Array.isArray(order.line_items) ? order.line_items.length : 0}</td>
                        <td className="py-2 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
