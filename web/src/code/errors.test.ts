// Tests for the plain-words error translator (pure TypeScript).
import { describe, expect, it } from "vitest";
import { editDistance, parseTraceback, suggest, translateError } from "./errors";

describe("suggest", () => {
  it("finds close names", () => {
    expect(suggest("plase_hub", ["place_hub", "sites"])).toBe("place_hub");
    expect(suggest("pritn", ["print", "len"])).toBe("print"); // swapped letters
    expect(suggest("City", ["city"])).toBe("city");
  });
  it("returns null when nothing is close", () => {
    expect(suggest("banana", ["place_hub", "sites"])).toBeNull();
  });
  it("counts a swap as one edit", () => {
    expect(editDistance("ab", "ba")).toBe(1);
  });
});

describe("translateError", () => {
  it("NameError with a typo suggests city.place_hub", () => {
    const r = translateError({
      type: "NameError",
      message: "name 'plase_hub' is not defined",
      name: "plase_hub",
      line: 3,
    });
    expect(r.line).toBe(3);
    expect(r.friendly).toMatch(/^Line 3: /);
    expect(r.friendly).toContain("`plase_hub`");
    expect(r.friendly).toContain("Did you mean `city.place_hub`?");
  });

  it("NameError for a bare city function explains the city. prefix", () => {
    const r = translateError({ type: "NameError", message: "name 'place_hub' is not defined", name: "place_hub", line: 1 });
    expect(r.friendly).toContain("city.place_hub");
  });

  it("NameError suggests the student's own variable", () => {
    const r = translateError({
      type: "NameError",
      message: "name 'plces' is not defined",
      name: "plces",
      candidates: ["places", "city", "print"],
      line: 4,
    });
    expect(r.friendly).toContain("Did you mean `places`?");
  });

  it("NameError with no close match asks about creating the variable", () => {
    const r = translateError({ type: "NameError", message: "name 'zebra' is not defined", name: "zebra", line: 2 });
    expect(r.friendly).toContain("`zebra`");
    expect(r.friendly).not.toContain("Did you mean");
  });

  it("AttributeError on city", () => {
    const r = translateError({
      type: "AttributeError",
      message: "module 'city' has no attribute 'plase_hub'",
      name: "plase_hub",
      objType: "module:city",
      line: 5,
    });
    expect(r.friendly).toBe("Line 5: The `city` toolbox has no `plase_hub`. Did you mean `city.place_hub`?");
  });

  it("AttributeError on a Site suggests the right attribute", () => {
    const r = translateError({
      type: "AttributeError",
      message: "'Site' object has no attribute 'familes_nearby'",
      name: "familes_nearby",
      objType: "Site",
      line: 2,
    });
    expect(r.friendly).toContain("Did you mean `families_nearby`?");
  });

  it("AttributeError: list used like a site", () => {
    const r = translateError({
      type: "AttributeError",
      message: "'list' object has no attribute 'name'",
      objType: "list",
      line: 2,
    });
    expect(r.friendly).toContain("loop");
  });

  it("IndentationError", () => {
    const r = translateError({
      type: "IndentationError",
      message: "expected an indented block after 'for' statement on line 2",
      line: 3,
    });
    expect(r.friendly).toMatch(/^Line 3: Python expected this line to be indented/);
  });

  it("SyntaxError variants", () => {
    expect(translateError({ type: "SyntaxError", message: "'(' was never closed", line: 1 }).friendly).toContain("Add a matching `)`");
    expect(translateError({ type: "SyntaxError", message: "expected ':'", line: 2 }).friendly).toContain("colon");
    expect(translateError({ type: "SyntaxError", message: "unterminated string literal (detected at line 1)", line: 1 }).friendly).toContain("quote");
    const generic = translateError({ type: "SyntaxError", message: "invalid syntax", text: "for x in", line: 7 });
    expect(generic.friendly).toContain("`for x in`");
  });

  it("TypeError: wrong number of arguments", () => {
    expect(translateError({ type: "TypeError", message: "place_hub() takes 1 positional argument but 2 were given", line: 4 }).friendly)
      .toContain("`place_hub` wants 1 thing inside the parentheses, but you gave 2");
    expect(translateError({ type: "TypeError", message: "place_hub() missing 1 required positional argument: 'site'", line: 4 }).friendly)
      .toContain("needs something inside the parentheses");
  });

  it("TypeError: not iterable", () => {
    expect(translateError({ type: "TypeError", message: "'int' object is not iterable", line: 2 }).friendly).toContain("can't loop over a `int`");
  });

  it("IndexError", () => {
    const r = translateError({ type: "IndexError", message: "list index out of range", line: 6 });
    expect(r.friendly).toMatch(/^Line 6: .*start counting at 0/);
  });

  it("CityError message passes through", () => {
    const r = translateError({ type: "CityError", message: "I can't find a place called \"Nonexistent\".", line: 1 });
    expect(r.friendly).toBe("Line 1: I can't find a place called \"Nonexistent\".");
  });

  it("omits the Line prefix when the line is unknown", () => {
    const r = translateError({ type: "ZeroDivisionError", message: "division by zero" });
    expect(r.line).toBeUndefined();
    expect(r.friendly).not.toMatch(/^Line/);
  });

  it("falls back to a generic sentence", () => {
    const r = translateError({ type: "WeirdError", message: "oops", line: 1 });
    expect(r.friendly).toBe("Line 1: Python hit a problem: WeirdError: oops.");
  });
});

describe("parseTraceback", () => {
  it("reads the student's line and error", () => {
    const tb = [
      "Traceback (most recent call last):",
      '  File "<student>", line 3, in <module>',
      "    plase_hub(x)",
      "NameError: name 'plase_hub' is not defined",
    ].join("\n");
    const info = parseTraceback(tb);
    expect(info).toMatchObject({ type: "NameError", line: 3, message: "name 'plase_hub' is not defined" });
    expect(translateError(info).friendly).toContain("Line 3");
  });
});
