import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";
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

        const existing = await db.collection("borrow").findOne({ _id: oid });
        if (!existing) {
            return NextResponse.json(
                { message: "Borrow request not found" },
                { status: 404, headers: corsHeaders }
            );
        }

        const result = await db.collection("borrow").findOneAndUpdate(
            { _id: oid },
            { $set: { requestStatus, updatedAt: new Date() } },
            { returnDocument: "after" }
        );

        // Restore book quantity when admin cancels a request that had decremented it
        if (
            requestStatus === "CANCEL-ADMIN" &&
            (existing.requestStatus === "INIT" || existing.requestStatus === "ACCEPTED")
        ) {
            await db.collection("book").updateOne(
                { _id: existing.bookId },
                { $inc: { quantity: 1 } }
            );
        }

        return NextResponse.json(result, { status: 200, headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
    }
}

// DELETE /api/borrow/[id] — cancel a borrow request (authenticated USER, own requests only)
export async function DELETE(req, { params }) {
    const authResult = requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const caller = authResult;

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
        const client = await getClientPromise();
        const db = client.db("wad-final");

        const borrowRequest = await db.collection("borrow").findOne({ _id: oid });

        if (!borrowRequest) {
            return NextResponse.json(
                { message: "Borrow request not found" },
                { status: 404, headers: corsHeaders }
            );
        }

        const callerId = caller.id ?? caller._id ?? caller.email;
        if (borrowRequest.userId !== callerId) {
            return NextResponse.json(
                { message: "Forbidden: you can only cancel your own requests" },
                { status: 403, headers: corsHeaders }
            );
        }

        if (borrowRequest.requestStatus !== "INIT") {
            return NextResponse.json(
                { message: "Only requests with status INIT can be cancelled" },
                { status: 400, headers: corsHeaders }
            );
        }

        const result = await db.collection("borrow").findOneAndUpdate(
            { _id: oid },
            { $set: { requestStatus: "CANCEL-USER", updatedAt: new Date() } },
            { returnDocument: "after" }
        );

        // Restore book quantity — previous status was guaranteed INIT by the guard above
        await db.collection("book").updateOne(
            { _id: borrowRequest.bookId },
            { $inc: { quantity: 1 } }
        );

        return NextResponse.json(result, { status: 200, headers: corsHeaders });
    } catch (err) {
        return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
    }
}
