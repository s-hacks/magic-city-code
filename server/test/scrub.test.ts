import { describe, expect, it } from "vitest";
import { scrub } from "../src/scrub";

describe("scrub", () => {
  it("removes names after my name is / I'm / this is", () => {
    expect(scrub("Hi, my name is Mary Johnson and I need food.")).toBe("Hi, my name is [name] and I need food.");
    expect(scrub("I'm Tasha, a mom of three.")).toBe("I'm [name], a mom of three.");
    expect(scrub("This is Mr. Jones from church.")).toBe("This is [name] from church.");
    expect(scrub("I am Robert.")).toBe("I am [name].");
  });

  it("leaves ordinary words and places alone", () => {
    expect(scrub("I'm worried about my kids.")).toBe("I'm worried about my kids.");
    expect(scrub("This is West End, and we have no store.")).toBe("This is West End, and we have no store.");
    expect(scrub("I'm in Ensley.", { keepWords: ["Ensley"] })).toBe("I'm in Ensley.");
    expect(scrub("I walk 20 minutes to the bus.")).toBe("I walk 20 minutes to the bus.");
    expect(scrub("I have 2 kids drive me to the store sometimes.")).toBe("I have 2 kids drive me to the store sometimes.");
  });

  it("removes phone numbers in common shapes", () => {
    expect(scrub("Call me at 205-555-1234.")).toBe("Call me at [phone].");
    expect(scrub("Call (205) 555 1234 or 205.555.9876")).toBe("Call [phone] or [phone]");
    expect(scrub("text +1 205 555 1234 please")).toBe("text [phone] please");
  });

  it("removes emails", () => {
    expect(scrub("email mary.j+food@example.com today")).toBe("email [email] today");
  });

  it("removes street addresses", () => {
    expect(scrub("I live at 1420 3rd Ave N in West End.")).toBe("I live at [address] in West End.");
    expect(scrub("We're at 55 Main Street, Apt 4.")).toBe("We're at [address].");
    expect(scrub("by 800 Martin Luther King Jr Blvd")).toBe("by [address]");
    expect(scrub("at 12 oak st")).toBe("at [address]");
  });

  it("handles several details at once", () => {
    const out = scrub("My name is Ann Lee, I live at 10 Pine Road, call 2055551234 or ann@x.org");
    expect(out).not.toMatch(/Ann|Lee|Pine|2055551234|ann@x\.org/);
  });
});
