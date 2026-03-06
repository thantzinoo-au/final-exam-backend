import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { verifyJWT, requireRole } from "@/lib/auth";

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/book — list books
// ADMIN: sees all books (including deleted); supports ?showDeleted=true
// Others: only ACTIVE books
// Supports ?title= and ?author= filters
export async function GET(req) {
  try {
    const caller = verifyJWT(req);
    const isAdmin = caller?.role === "ADMIN";

    const { searchParams } = new URL(req.url);
    const titleFilter = searchParams.get("title");
    const authorFilter = searchParams.get("author");

    const query = {};

    // Non-admins only see active books
    if (!isAdmin) {
      query.status = "ACTIVE";
    }

    if (titleFilter) {
      query.title = { $regex: titleFilter, $options: "i" };
    }
    if (authorFilter) {
      query.author = { $regex: authorFilter, $options: "i" };
    }

    const client = await getClientPromise();
    const db = client.db("wad-final");
    const books = await db.collection("book").find(query).toArray();
    return NextResponse.json(books, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/book — create a book (ADMIN only)
export async function POST(req) {
  const authResult = requireRole(req, "ADMIN");
  if (authResult instanceof NextResponse) return authResult;

  try {
    const data = await req.json();
    const { title, author, quantity, location } = data;

    if (!title || !author || quantity === undefined || !location) {
      return NextResponse.json(
        { message: "title, author, quantity, and location are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = await getClientPromise();
    const db = client.db("wad-final");

    const book = {
      title,
      author,
      quantity: Number(quantity),
      location,
      status: "ACTIVE",
      createdAt: new Date(),
    };

    const result = await db.collection("book").insertOne(book);
    return NextResponse.json(
      { id: result.insertedId, ...book },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}
