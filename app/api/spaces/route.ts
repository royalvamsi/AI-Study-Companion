import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/spaces
 * Create a new Study Space for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // 1. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in again." }, { status: 401 });
    }

    // 2. Parse and validate payload
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Space name is required." }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Space name cannot exceed 100 characters." }, { status: 400 });
    }

    // 3. Insert space with verified server-side user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: space, error: insertError } = await (supabase.from("spaces") as any)
      .insert({
        user_id: user.id,
        name,
        description: description || null,
      })
      .select("id, name, description, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[POST /api/spaces] Database insert error:", insertError);
      return NextResponse.json(
        { error: "Unable to create Space. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ space }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/spaces] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the Space." },
      { status: 500 }
    );
  }
}
