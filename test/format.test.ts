import { describe, expect, it } from "vitest";
import { parseConfig } from "../lib/config.ts";
import { formatMoney, normalizeCep, plainText } from "../lib/format.ts";

describe("format", () => {
  it("formats cents as BRL", () => {
    expect(formatMoney({ amountCents: 19990, currency: "BRL" })).toBe("R$ 199,90");
  });

  it("normalizes a CEP", () => {
    expect(normalizeCep("01001000")).toBe("01001-000");
    expect(normalizeCep("01001-000")).toBe("01001-000");
    expect(normalizeCep("123")).toBeNull();
  });

  it("strips html from descriptions", () => {
    expect(plainText("<p>Óculos <b>de sol</b></p>")).toBe("Óculos de sol");
  });
});

describe("quick.config.json", () => {
  it("needs the VTEX account", () => {
    expect(() => parseConfig({ platform: "VTEX" })).toThrow("account");
    expect(parseConfig({ platform: "VTEX", account: "loja" }).salesChannel).toBe(1);
  });
});
