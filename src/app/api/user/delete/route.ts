import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteUserAccount, UserNotFoundError } from "@/lib/user-deletion";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteUserAccount(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
