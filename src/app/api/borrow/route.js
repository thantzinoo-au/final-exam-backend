import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { requireAuth, requireRole, verifyJWT } from "@/lib/auth";
import { ObjectId } from "mongodb";

const VALID_STATUSES = [
  "INIT",
  "CLOSE-NO-AVAILABLE-BOOK",
  "ACCEPTED",
  "CANCEL-ADMIN",
  "CANCEL-USER",
];

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/borrow — list borrow requests
// ADMIN: sees all requests
// USER: sees only their own requests
export async function GET(req) {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const caller = authResult;

  try {
    const client = await getClientPromise();
    const db = client.db("wad-final");

    const query = caller.role === "ADMIN" ? {} : { userId: caller.id ?? caller._id ?? caller.email };
    const requests = await db.collection("borrow").find(query).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(requests, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/borrow — submit a borrow request (authenticated USER)
export async function POST(req) {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const caller = authResult;

  try {
    const data = await req.json();
    const { bookId, targetDate } = data;

    if (!bookId || !targetDate) {
      return NextResponse.json(
        { message: "bookId and targetDate are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const parsedTargetDate = new Date(targetDate);
    if (isNaN(parsedTargetDate.getTime())) {
      return NextResponse.json(
        { message: "targetDate must be a valid date" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify the book exists and is active
    let bookOid;
    try { bookOid = new ObjectId(bookId); } catch {
      return NextResponse.json({ message: "Invalid bookId" }, { status: 400, headers: corsHeaders });
    }

    const client = await getClientPromise();
    const db = client.db("wad-final");

    const book = await db.collection("book").findOne({ _id: bookOid, status: "ACTIVE", quantity: { $gt: 0 } });
    const requestStatus = book ? "INIT" : "CLOSE-NO-AVAILABLE-BOOK";

    const borrowRequest = {
      userId: caller.id ?? caller._id ?? caller.email,
      bookId: bookOid,
      createdAt: new Date(),
      targetDate: parsedTargetDate,
      requestStatus,
    };

    const result = await db.collection("borrow").insertOne(borrowRequest);

    // Decrement book quantity when a valid request is created
    if (requestStatus === "INIT") {
      await db.collection("book").updateOne(
        { _id: bookOid },
        { $inc: { quantity: -1 } }
      );
    }

    return NextResponse.json(
      { id: result.insertedId, ...borrowRequest },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}