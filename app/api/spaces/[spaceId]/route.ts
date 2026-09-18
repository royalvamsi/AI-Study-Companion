import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/spaces/[spaceId]
 * Permanently delete a Study Space and cascade its dependent projects & data.
 * Restricted strictly to the Space owner.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;

    // 1. Validate spaceId format
    if (!spaceId || typeof spaceId !== "string" || !UUID_REGEX.test(spaceId.trim())) {
      return NextResponse.json(
        { error: "Invalid Space ID." },
        { status: 400 }
      );
    }

    const cleanSpaceId = spaceId.trim();
    const supabase = await createServerClient();

    // 2. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    // 3. Verify existence and ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: space, error: fetchError } = await (supabase.from("spaces") as any)
      .select("id, name, user_id")
      .eq("id", cleanSpaceId)
      .maybeSingle();

    if (fetchError) {
      console.error("[DELETE /api/spaces/[spaceId]] Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Unable to verify Space. Please try again." },
        { status: 500 }
      );
    }

    if (!space) {
      return NextResponse.json(
        { error: "Space not found." },
        { status: 404 }
      );
    }

    if (space.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not own this Space." },
        { status: 403 }
      );
    }

    // 4. Best-effort storage cleanup for materials belonging to this space's projects
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: projects } = await (supabase.from("projects") as any)
        .select("id")
        .eq("space_id", cleanSpaceId)
        .eq("user_id", user.id);

      if (projects && projects.length > 0) {
        const projectIds = projects.map((p: { id: string }) => p.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: materials } = await (supabase.from("materials") as any)
          .select("file_path")
          .in("project_id", projectIds);

        if (materials && materials.length > 0) {
          const filePaths = materials
            .map((m: { file_path: string | null }) => m.file_path)
            .filter((fp: string | null): fp is string => typeof fp === "string" && fp.length > 0);

          if (filePaths.length > 0) {
            await supabase.storage.from("materials").remove(filePaths);
          }
        }
      }
    } catch (storageErr) {
      console.warn("[DELETE /api/spaces/[spaceId]] Storage cleanup warning:", storageErr);
    }

    // 5. Delete space record from database (cascades all dependent project & learning records)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("spaces") as any)
      .delete()
      .eq("id", cleanSpaceId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[DELETE /api/spaces/[spaceId]] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Unable to delete Space. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: `Space "${space.name}" successfully deleted.` },
      { status: 200 }
    );
  } catch (err) {
    console.error("[DELETE /api/spaces/[spaceId]] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the Space." },
      { status: 500 }
    );
  }
}
