// TODO: Students must implement authentication and role-based access control here.
// Remove this stub and implement JWT verification and role checking as required in the exam.

import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import cookie from "cookie";
import corsHeaders from "@/lib/cors";

const JWT_SECRET = process.env.JWT_SECRET || "mydefaultjwtsecret"; // Use a strong secret in production

export function verifyJWT(req) {
    try {
        const cookies = req.headers.get("cookie") || "";
        const { token } = cookie.parse(cookies);

        if (!token) {
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        return null;
    }
}

export function requireRole(req, requiredRole) {
    const user = verifyJWT(req);
    if (!user) {
        return NextResponse.json(
            { message: "Unauthorized" },
            { status: 401, headers: corsHeaders }
        );
    }
    if (user.role !== requiredRole) {
        return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: corsHeaders }
        );
    }
    return user;
}

export function requireAuth(req) {
    const user = verifyJWT(req);
    if (!user) {
        return NextResponse.json(
            { message: "Unauthorized" },
            { status: 401, headers: corsHeaders }
        );
    }
    return user;
}
