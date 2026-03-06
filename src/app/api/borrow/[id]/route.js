import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { requireRole } from "@/lib/auth";
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

// PATCH /api/borrow/[id] — update borrow request status (ADMIN only)
export async function PATCH(req, { params }) {
    const authResult = requireRole(req, "ADMIN");
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    let oid;
    try {
        oid = new ObjectId(id);
    } catch {
        return NextResponse.json(
            { message: "Invalid borrow request id" },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const data = await req.json();
        const { requestStatus } = data;

        if (!requestStatus || !VALID_STATUSES.includes(requestStatus)) {
            return NextResponse.json(
                { message: `requestStatus must be one of: ${VALID_STATUSES.join(", ")}` },
                { status: 400, headers: corsHeaders }
            );
        }

        const client = await getClientPromise();
        const db = client.db("wad-final");
        const result = await db.collection("borrow").findOneAndUpdate(
            { _id: oid },
            { $set: { requestStatus, updatedAt: new Date() } },
            { returnDocument: "after" }
        );

        if (!result) {
            return NextResponse.json(
                { message: "Borrow request not found" },
                { status: 404, headers: corsHeaders }
            );
        }
        return NextResponse.json(result, { status: 200, headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
    }
}
