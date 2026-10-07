import { describe, expect, it } from "vitest";
import { mapOpenError } from "../pdfjs";
import { CompressError } from "../types";

// Bentuk error yang dilempar pdf.js (BaseException: name + message + code).
function pdfjsError(name: string, message: string, code?: number): Error {
  const err = new Error(message) as Error & { code?: number };
  err.name = name;
  if (code !== undefined) err.code = code;
  return err;
}

describe("mapOpenError", () => {
  it("PDF berpassword tanpa password -> needs-password", () => {
    const e = mapOpenError(pdfjsError("PasswordException", "No password given", 1), false);
    expect(e).toBeInstanceOf(CompressError);
    expect(e.code).toBe("needs-password");
  });

  it("password salah -> wrong-password", () => {
    expect(mapOpenError(pdfjsError("PasswordException", "Incorrect Password", 2), true).code).toBe("wrong-password");
  });

  it("password diisi tapi pdf.js masih minta password -> wrong-password", () => {
    expect(mapOpenError(pdfjsError("PasswordException", "No password given", 1), true).code).toBe("wrong-password");
  });

  it("struktur rusak -> corrupt", () => {
    expect(mapOpenError(pdfjsError("InvalidPDFException", "Invalid PDF structure."), false).code).toBe("corrupt");
    expect(mapOpenError("aneh", false).code).toBe("corrupt");
  });

  it("worker gagal dimuat bukan salah file", () => {
    const e = mapOpenError(new Error('Setting up fake worker failed: "Failed to fetch dynamically imported module".'), false);
    expect(e.code).toBe("unsupported");
  });

  it("CompressError diteruskan apa adanya", () => {
    const original = new CompressError("aborted", "Dibatalkan.");
    expect(mapOpenError(original, false)).toBe(original);
  });
});
