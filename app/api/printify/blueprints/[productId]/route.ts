import { NextResponse } from "next/server";

interface PrintifyBlueprintAttribute {
  name: string;
  id: string;
  values?: Array<{ id: string | number; title: string }>;
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

    if (!printifyToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Printify configuration missing",
        },
        { status: 500 },
      );
    }

    // Fetch product blueprint from Printify catalog
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
      id?: number;
      title?: string;
      description?: string;
      brand?: string;
      model?: string;
      images?: string[];
      print_areas?: Array<{ id: string; label: string }>;
      options?: PrintifyBlueprintAttribute[];
    };

    // Also fetch print providers for this blueprint
    let printProviders: Array<{ id: number; title: string }> = [];
    let variantIds: number[] = [];

    try {
      const providersResponse = await fetch(
        `https://api.printify.com/v1/catalog/blueprints/${productId}/print_providers.json`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${printifyToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (providersResponse.ok) {
        printProviders = (await providersResponse.json()) as Array<{
          id: number;
          title: string;
        }>;

        // Fetch variants for the first print provider
        if (printProviders.length > 0) {
          const variantsResponse = await fetch(
            `https://api.printify.com/v1/catalog/blueprints/${productId}/print_providers/${printProviders[0].id}/variants.json`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${printifyToken}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (variantsResponse.ok) {
            const variantsData = (await variantsResponse.json()) as {
              variants?: Array<{ id: number; title: string; options?: Record<string, unknown> }>;
            };
            variantIds = (variantsData.variants || [])
              .slice(0, 10)
              .map((v) => v.id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching print providers:", error);
    }

    const firstProvider = printProviders[0];

    // Transform Printify response into our attribute format
    // locked=true fields are system-managed and not user-editable
    const attributes: Record<string, unknown> = {
      blueprint_id: {
        type: "number",
        label: "Blueprint ID",
        value: data.id || parseInt(productId),
        locked: true,
        required: true,
      },
      print_provider_id: {
        type: "number",
        label: "Print Provider ID",
        value: firstProvider?.id || 0,
        locked: true,
        required: true,
      },
      product_type: {
        type: "text",
        label: "Product Type",
        value: data.title || productId,
        locked: true,
        required: true,
      },
      variant_ids: {
        type: "text",
        label: "Variant IDs",
        value: variantIds.join(","),
        locked: true,
        required: true,
      },
    };

    // Add print areas as editable selection
    if (data.print_areas && data.print_areas.length > 0) {
      attributes.print_areas = {
        type: "selection",
        label: "Print Areas",
        value: [data.print_areas[0]?.label || "Front"],
        options: data.print_areas.map((pa) => pa.label),
        locked: false,
      };
    } else {
      attributes.print_areas = {
        type: "selection",
        label: "Print Areas",
        value: ["Front"],
        options: ["Front", "Back", "Sleeve"],
        locked: false,
      };
    }

    // Add options from Printify blueprint (colors, sizes, etc.)
    if (data.options) {
      data.options.forEach((opt) => {
        const optionValues = opt.values?.map((v) => v.title) || [];
        attributes[opt.id || opt.name.toLowerCase().replace(/\s+/g, "_")] = {
          type: "selection",
          label: opt.name,
          value: optionValues.length > 0 ? [optionValues[0]] : [],
          options: optionValues,
          locked: false,
        };
      });
    }

    // Add tags field
    attributes.tags = {
      type: "text",
      label: "Tags",
      value: "",
      placeholder: "Comma-separated tags (e.g. minimalist, streetwear)",
      locked: false,
    };

    return NextResponse.json({
      success: true,
      attributes,
      source: "printify",
      productTitle: data.title,
      productBrand: data.brand,
      productDescription: data.description,
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
    blueprint_id: {
      type: "number",
      label: "Blueprint ID",
      value: parseInt(productId) || 0,
      locked: true,
      required: true,
    },
    print_provider_id: {
      type: "number",
      label: "Print Provider ID",
      value: 0,
      locked: true,
      required: true,
    },
    product_type: {
      type: "text",
      label: "Product Type",
      value: productId,
      locked: true,
      required: true,
    },
    variant_ids: {
      type: "text",
      label: "Variant IDs",
      value: "",
      locked: true,
      required: true,
    },
    print_areas: {
      type: "selection",
      label: "Print Areas",
      value: [],
      options: ["Front", "Back", "Sleeve", "Side"],
      locked: false,
    },
    size_range: {
      type: "selection",
      label: "Size Range",
      value: [],
      options: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
      locked: false,
    },
    material: {
      type: "selection",
      label: "Material",
      value: [],
      options: ["Cotton", "Polyester", "Cotton Blend"],
      locked: false,
    },
    color_options: {
      type: "selection",
      label: "Color Options",
      value: [],
      options: ["Black", "White", "Navy", "Red", "Gray"],
      locked: false,
    },
    tags: {
      type: "text",
      label: "Tags",
      value: "",
      placeholder: "Comma-separated tags",
      locked: false,
    },
  };

  return baseAttributes;
}
