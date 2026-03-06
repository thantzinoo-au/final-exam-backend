import { ensureIndexes } from "@/lib/ensureIndexes";
import { NextResponse } from "next/server";
import { getClientPromise } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";

const bookSeedData = [
  { title: "To Kill a Mockingbird", author: "Harper Lee" },
  { title: "1984", author: "George Orwell" },
  { title: "Pride and Prejudice", author: "Jane Austen" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
  { title: "Moby-Dick", author: "Herman Melville" },
  { title: "The Catcher in the Rye", author: "J.D. Salinger" },
  { title: "Jane Eyre", author: "Charlotte Brontë" },
  { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
  { title: "Frankenstein", author: "Mary Shelley" },
  { title: "Don Quixote", author: "Miguel de Cervantes" },
  { title: "Beloved", author: "Toni Morrison" },
  { title: "Fahrenheit 451", author: "Ray Bradbury" },
  { title: "Wuthering Heights", author: "Emily Brontë" },
  { title: "The Grapes of Wrath", author: "John Steinbeck" },
  { title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
  { title: "Brave New World", author: "Aldous Huxley" },
  { title: "The Hobbit", author: "J.R.R. Tolkien" },
  { title: "The Diary of a Young Girl", author: "Anne Frank" },
  { title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling" },
];

const userSeedData = [
  // Admin account
  {
    name: "Admin User",
    username: "admin",
    email: "admin@test.com",
    password: "admin123",
    role: "ADMIN",
  },
  // Sample user accounts
  {
    name: "Thant Zin Oo",
    username: "user",
    email: "user@test.com",
    password: "user123",
    role: "USER",
  }
];

async function seedBooks() {
  const client = await getClientPromise();
  const db = client.db("wad-final");

  const results = { created: 0, skipped: 0 };

  for (const data of bookSeedData) {
    const exists = await db.collection("book").findOne({ title: data.title });
    if (exists) {
      results.skipped++;
      continue;
    }
    await db.collection("book").insertOne({
      ...data,
      quantity: 1,
      location: "AU Book Store",
      status: "ACTIVE",
      createdAt: new Date(),
    });
    results.created++;
  }

  return results;
}

async function seedUsers() {
  const client = await getClientPromise();
  const db = client.db("wad-final");

  const results = { created: 0, skipped: 0 };

  for (const data of userSeedData) {
    const exists = await db.collection("user").findOne({
      $or: [{ email: data.email }],
    });
    if (exists) {
      results.skipped++;
      continue;
    }
    const hashed = await hashPassword(data.password);
    await db.collection("user").insertOne({ ...data, password: hashed });
    results.created++;
  }

  return results;
}

async function seedAll() {
  const [users, books] = await Promise.all([seedUsers(), seedBooks()]);
  return { users, books };
}

export async function GET(request) {

  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("pass") ?? false;

  if (!challenge) {
    return NextResponse.json({
      message: "Invalid usage"
    }, {
      status: 400
    })
  }

  const pass = process.env.ADMIN_SETUP_PASS;

  if (challenge != pass) {
    return NextResponse.json({
      message: "Admin password incorrect"
    }, {
      status: 400
    })
  }

  const result = await ensureIndexes();
  const seedResults = await seedAll();
  return NextResponse.json({
    message: "Indexes ensured and seed data loaded",
    seed: seedResults,
  });
}