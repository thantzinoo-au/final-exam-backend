import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { verifyJWT, requireRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// GET /api/book/[id] — get a single book
// ADMIN: can view deleted books; others: 404 if deleted
export async function GET(req, { params }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) {
    return NextResponse.json({ message: "Invalid book id" }, { status: 400, headers: corsHeaders });
  }

  try {
    const caller = verifyJWT(req);
    const isAdmin = caller?.role === "ADMIN";

    const client = await getClientPromise();
    const db = client.db("wad-final");
    const book = await db.collection("book").findOne({ _id: oid });

    if (!book || (!isAdmin && book.status === "DELETED")) {
      return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json(book, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/book/[id] — update a book (ADMIN only)
// Updatable fields: title, author, quantity, location, status
export async function PATCH(req, { params }) {
  const authResult = requireRole(req, "ADMIN");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) {
    return NextResponse.json({ message: "Invalid book id" }, { status: 400, headers: corsHeaders });
  }

  const VALID_STATUSES = ["ACTIVE", "DELETED"];

  try {
    const data = await req.json();
    const { title, author, quantity, location, status } = data;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (author !== undefined) updates.author = author;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (location !== undefined) updates.location = location;
    if (status !== undefined) updates.status = status;
    updates.updatedAt = new Date();

    const client = await getClientPromise();
    const db = client.db("wad-final");
    const result = await db.collection("book").findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/book/[id] — soft delete a book (ADMIN only)
// Sets status to "DELETED" instead of removing the document
export async function DELETE(req, { params }) {
  const authResult = requireRole(req, "ADMIN");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) {
    return NextResponse.json({ message: "Invalid book id" }, { status: 400, headers: corsHeaders });
  }

  try {
    const client = await getClientPromise();
    const db = client.db("wad-final");
    const result = await db.collection("book").findOneAndUpdate(
      { _id: oid },
      { $set: { status: "DELETED", updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!result) {
      return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({ message: "Book deleted", book: result }, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}
