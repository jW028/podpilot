import { getServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  businessId: string;
  productId: string;
}

/**
 * GET /api/business/[businessId]/products/[productId]/image
 * Returns the public URL for the product's design image from Supabase bucket.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { productId } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Check if file exists by listing
    const { data: files } = await supabase.storage
      .from("products")
      .list("", { search: productId });

    const matchingFile = files?.find((f) => f.name.startsWith(productId));

    if (!matchingFile) {
      return NextResponse.json({ url: null }, { status: 200 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("products")
      .getPublicUrl(matchingFile.name);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Error fetching product image:", error);
    return NextResponse.json(
      { error: "Failed to fetch product image" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/business/[businessId]/products/[productId]/image
 * Upload a product design image to Supabase 'products' bucket.
 * Expects multipart form data with a 'file' field.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { businessId, productId } = await params;
    const supabase = await getServerSupabase();

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    // Verify product belongs to business
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("business_id", businessId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 },
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Determine file extension
    const ext = file.name.split(".").pop() || "png";
    const timestamp = Date.now();
    const fileName = `${productId}-${timestamp}.${ext}`;

    // Use service role client for storage operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceRole);

    // First, list and delete any existing files for this product
    const { data: existingFiles } = await serviceClient.storage
      .from("products")
      .list("", { search: productId });

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles
        .filter((f) => f.name.startsWith(productId))
        .map((f) => f.name);
      
      if (filesToDelete.length > 0) {
        await serviceClient.storage.from("products").remove(filesToDelete);
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { error: uploadError } = await serviceClient.storage
      .from("products")
      .upload(fileName, buffer, {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = serviceClient.storage
      .from("products")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error uploading product image:", error);
    return NextResponse.json(
      { error: "Failed to upload product image" },
      { status: 500 },
    );
  }
}
