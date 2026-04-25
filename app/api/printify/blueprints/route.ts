import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/printify/blueprints
 * Search Printify catalog blueprints. Accepts optional ?q= query param to filter.
 * Returns real available product types from Printify's catalog API.
 */
export async function GET(request: NextRequest) {
  try {
    const printifyToken = process.env.PRINTIFY_DEV_TOKEN;

    if (!printifyToken) {
      return NextResponse.json(
        { success: false, message: "Printify token not configured" },
        { status: 500 },
      );
    }

    const query = request.nextUrl.searchParams.get("q") || "";

    // Fetch all blueprints from Printify catalog
    const response = await fetch(
      "https://api.printify.com/v1/catalog/blueprints.json",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Printify catalog error:", errorText);
      return NextResponse.json(
        { success: false, message: "Failed to fetch Printify catalog" },
        { status: 502 },
      );
    }

    const blueprints = (await response.json()) as Array<{
      id: number;
      title: string;
      description: string;
      brand: string;
      model: string;
      images: string[];
    }>;

    // Filter by query if provided
    let filtered = blueprints;
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = blueprints.filter(
        (bp) =>
          bp.title?.toLowerCase().includes(q) ||
          bp.description?.toLowerCase().includes(q) ||
          bp.brand?.toLowerCase().includes(q) ||
          bp.model?.toLowerCase().includes(q),
      );
    }

    // Return top 20 results
    const results = filtered.slice(0, 20).map((bp) => ({
      id: String(bp.id),
      title: bp.title,
      description: bp.description,
      brand: bp.brand,
      model: bp.model,
      image: bp.images?.[0] || null,
    }));

    return NextResponse.json({
      success: true,
      blueprints: results,
      total: filtered.length,
    });
  } catch (error) {
    console.error("Printify blueprints search error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to search Printify catalog",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
