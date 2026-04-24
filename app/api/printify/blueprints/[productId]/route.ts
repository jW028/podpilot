import { NextResponse } from "next/server";

interface PrintifyBlueprintAttribute {
  name: string;
  id: string;
  values?: Array<{ id: string; title: string }>;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ productId: string }>;
  },
) {
  try {
    const { productId } = await params;
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

    // Fetch product blueprint from Printify
    const response = await fetch(
      `https://api.printify.com/v1/catalog/blueprints/${productId}.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      // Fallback attributes based on product type
      const fallbackAttributes = getFallbackAttributesForProduct(productId);
      return NextResponse.json({
        success: true,
        attributes: fallbackAttributes,
        source: "fallback",
      });
    }

    const data = (await response.json()) as {
      title?: string;
      description?: string;
      printAreas?: Array<{ id: string; label: string }>;
      options?: PrintifyBlueprintAttribute[];
    };

    // Transform Printify response into our attribute format
    const attributes: Record<string, unknown> = {
      print_provider_id: {
        type: "text",
        label: "Print Provider ID",
        value: productId,
        required: true,
      },
      print_areas: {
        type: "selection",
        label: "Print Areas",
        value: [],
        options: data.printAreas?.map((pa) => pa.label) || [
          "Front",
          "Back",
          "Sleeve",
        ],
        required: true,
      },
      product_type: {
        type: "text",
        label: "Product Type",
        value: data.title || productId,
        required: true,
      },
    };

    // Add options from Printify
    if (data.options) {
      data.options.forEach((opt) => {
        attributes[opt.id] = {
          type: "selection",
          label: opt.name,
          value: [],
          options: opt.values?.map((v) => v.title) || [],
        };
      });
    }

    return NextResponse.json({
      success: true,
      attributes,
      source: "printify",
      productTitle: data.title,
    });
  } catch (error) {
    console.error("Printify blueprint error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch Printify product attributes",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function getFallbackAttributesForProduct(
  productId: string,
): Record<string, unknown> {
  const baseAttributes = {
    print_provider_id: {
      type: "text",
      label: "Print Provider ID",
      value: productId,
      required: true,
    },
    print_areas: {
      type: "selection",
      label: "Print Areas",
      value: [],
      options: ["Front", "Back", "Sleeve", "Side"],
      required: true,
    },
    product_type: {
      type: "text",
      label: "Product Type",
      value: productId,
      required: true,
    },
    size_range: {
      type: "selection",
      label: "Size Range",
      value: [],
      options: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    },
    material: {
      type: "selection",
      label: "Material",
      value: [],
      options: ["Cotton", "Polyester", "Cotton Blend"],
    },
    color_options: {
      type: "selection",
      label: "Color Options",
      value: [],
      options: ["Black", "White", "Navy", "Red", "Gray"],
    },
  };

  return baseAttributes;
}
