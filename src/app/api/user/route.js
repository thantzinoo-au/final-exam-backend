
// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/user — list all users (ADMIN only)
export async function GET(req) {
  const authResult = requireRole(req, "ADMIN");
  if (authResult instanceof NextResponse) return authResult;

  try {
    const client = await getClientPromise();
    const db = client.db("wad-final");
    const users = await db
      .collection("user")
      .find({}, { projection: { password: 0 } })
      .toArray();
    return NextResponse.json(users, { status: 200, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  const data = await req.json();
  const username = data.username;
  const email = data.email;
  const password = data.password;
  const firstname = data.firstname;
  const lastname = data.lastname;

  if (!username || !email || !password) {
    return NextResponse.json({
      message: "Missing mandatory data"
    }, {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    const client = await getClientPromise();
    const db = client.db("wad-final");
    const result = await db.collection("user").insertOne({
      username: username,
      email: email,
      password: await bcrypt.hash(password, 10),
      firstname: firstname,
      lastname: lastname,
      status: "ACTIVE"
    });
    return NextResponse.json({
      id: result.insertedId
    }, {
      status: 200,
      headers: corsHeaders
    });
  }
  catch (exception) {
    const errorMsg = exception.toString();
    let displayErrorMsg = "";
    if (errorMsg.includes("duplicate")) {
      if (errorMsg.includes("username")) {
        displayErrorMsg = "Duplicate Username!!"
      }
      else if (errorMsg.includes("email")) {
        displayErrorMsg = "Duplicate Email!!"
      }
    }
    return NextResponse.json({
      message: displayErrorMsg
    }, {
      status: 400,
      headers: corsHeaders
    })
  }

}