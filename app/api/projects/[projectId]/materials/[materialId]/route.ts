import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { deleteMaterial } from "@/lib/materials/delete";

/**
 * DELETE /api/projects/[projectId]/materials/[materialId]
 * Permanently deletes a study material, its storage file, and its processed database records.
 * Restricted strictly to the authenticated project owner.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; materialId: string }> }
) {
  try {
    const { projectId, materialId } = await params;
    const supabase = await createServerClient();

    // 1. Authenticate user
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

    // 2. Delegate to reusable deletion service
    const result = await deleteMaterial({
      projectId,
      materialId,
      userId: user.id,
      supabase,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete material." },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        material: result.material,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/projects/[projectId]/materials/[materialId]] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the material." },
      { status: 500 }
    );
  }
}
