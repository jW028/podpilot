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

interface OrderForm {
  productLaunchId: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
}

export default function PlaceOrderPage({ businessId }: { businessId: string }) {
  const [productLaunches, setProductLaunches] = useState<ProductLaunch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<OrderForm>({
    productLaunchId: "",
    customerName: "",
    customerEmail: "",
    quantity: 1,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [launchesRes, ordersRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/product-launches`),
        fetch(`/api/orders?businessId=${businessId}`),
      ]);

      if (launchesRes.ok) {
        const launchesData = await launchesRes.json();
        setProductLaunches(launchesData.launches || []);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLastOrderNumber(null);

    try {
      const selectedLaunch = productLaunches.find((l) => l.id === form.productLaunchId);
      const productTitle = selectedLaunch?.products?.title || "Sample Product";
      const lineItems = [
        {
          title: productTitle,
          quantity: form.quantity,
          price: 29.9,
        },
      ];

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
      await fetchData();
    } catch {
      setError("Network error placing order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading products...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Place Order Form */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Place a Test Order</h2>

        {lastOrderNumber && (
          <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            Order created: <span className="font-mono font-bold">{lastOrderNumber}</span>
            {" — "}you can now search for this in the support chat.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select
              value={form.productLaunchId}
              onChange={(e) => setForm((f) => ({ ...f, productLaunchId: e.target.value }))}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
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
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                placeholder="test@example.com"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
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
              className="w-24 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium text-white"
          >
            {submitting ? "Placing..." : "Place Order (RM 29.90 each)"}
          </button>
        </form>
      </section>

      {/* Existing Orders */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Existing Orders</h2>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet. Place one above to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="pb-2 pr-4">Order #</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Items</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 font-mono text-blue-400">{order.order_number}</td>
                    <td className="py-2 pr-4">{order.customer_name}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          order.status === "shipped" ? "bg-green-500/20 text-green-400"
                            : order.status === "delivered" ? "bg-blue-500/20 text-blue-400"
                            : order.status === "cancelled" || order.status === "refunded" ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">RM {Number(order.total_amount).toFixed(2)}</td>
                    <td className="py-2 pr-4">{Array.isArray(order.line_items) ? order.line_items.length : 0}</td>
                    <td className="py-2 text-gray-400">{new Date(order.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
