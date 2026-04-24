import { NextResponse } from "next/server";

interface PrintifyProduct {
  id: string;
  title: string;
  description?: string;
  type?: string;
  images?: Array<{ src: string }>;
}

interface PrintifyAttribute {
  name: string;
  id: string;
  values?: Array<{ id: string; title: string }>;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const printifyToken = process.env.PRINTIFY_DEV_TOKEN;
    const printifyShopId = process.env.PRINTIFY_SHOP_ID;

    if (!printifyToken || !printifyShopId) {
      return NextResponse.json(
        {
          success: false,
          message: "Printify configuration missing",
        },
        { status: 500 },
      );
    }

    // Fetch catalog products from Printify
    const response = await fetch(
      `https://api.printify.com/v1/shops/${printifyShopId}/products.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      // Fallback: return suggested product types if Printify call fails
      const suggestedTypes = [
        {
          id: "t-shirt",
          title: "T-Shirt",
          description: "Classic cotton t-shirt",
          printProvider: "printful",
        },
        {
          id: "hoodie",
          title: "Hoodie",
          description: "Comfortable pullover hoodie",
          printProvider: "printful",
        },
        {
          id: "mug",
          title: "Mug",
          description: "11oz ceramic mug",
          printProvider: "printful",
        },
        {
          id: "tote-bag",
          title: "Tote Bag",
          description: "Canvas tote bag",
          printProvider: "printful",
        },
        {
          id: "poster",
          title: "Poster",
          description: "A4/A3 poster print",
          printProvider: "printful",
        },
      ];

      return NextResponse.json({
        success: true,
        products: suggestedTypes,
        source: "fallback",
      });
    }

    const data = (await response.json()) as { data?: PrintifyProduct[] };
    const products =
      data.data
        ?.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          image: p.images?.[0]?.src,
        }))
        .slice(0, 10) || []; // Return first 10 products

    return NextResponse.json({
      success: true,
      products,
      source: "printify",
    });
  } catch (error) {
    console.error("Printify products error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch Printify products",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
