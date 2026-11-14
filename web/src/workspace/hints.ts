// One plain-words hint per common Python error, shown under the error in the Output panel.
import type { PyError } from "./pyProject";

export function hintFor(e: PyError): string | null {
  const m = e.message;
  switch (e.type) {
    case "SyntaxError":
      return "Python couldn't read this line. Look for a missing colon, bracket or quote, on this line or the one above.";
    case "IndentationError":
    case "TabError":
      return "The spaces at the start of this line don't line up. Lines inside the same block need the same indent (4 spaces).";
    case "NameError": {
      const name = /name '([^']+)'/.exec(m)?.[1];
      return name ? `Python doesn't know "${name}" yet. Check the spelling, or make sure it's defined (or imported) before this line.` : "Something is used before it's defined. Check the spelling.";
    }
    case "ModuleNotFoundError":
    case "ImportError":
      return "That import didn't work. Your own files import by name without .py (from helpers import load), and a folder needs the file inside it (from drains.load import …). Only Python's built-in modules are here, no pandas.";
    case "FileNotFoundError":
      return "That file isn't there. Paths start at the project folder, like open(\"data/reports.csv\"). Check the name in the file tree.";
    case "KeyError":
      return "You asked a dictionary for a key it doesn't have. Print the dictionary's keys, or use .get(key, default).";
    case "IndexError":
      return "You asked a list for a spot past its end. Remember the first item is [0] and the last is [len(x) - 1].";
    case "TypeError":
      if (/not subscriptable/.test(m)) return "You used [ ] on something that isn't a list or dictionary (often None). Check what the function returned.";
      if (/argument/.test(m)) return "A function got the wrong number of inputs. Compare the call with the def line.";
      if (/unsupported operand|can only concatenate/.test(m)) return "Two different kinds of values were mixed, like a number and text. Values read from a CSV are text: wrap them in int() or float().";
      return "A value was the wrong type for what you did with it. Print it to see what it really is.";
    case "ValueError":
      if (/invalid literal for int|could not convert/.test(m)) return "int() or float() got text that isn't a number. Some CSV cells may be blank: skip those rows or check first.";
      return "A value had the right type but the wrong content. Print it just before this line.";
    case "ZeroDivisionError":
      return "Something was divided by zero. Check for an empty list or a count of 0 before you divide.";
    case "AttributeError":
      return /NoneType/.test(m) ? "Something is None here. A function probably forgot to return its answer." : "That value doesn't have that method or field. Check the spelling, and what type it is.";
    case "RecursionError":
      return "A function called itself too many times. Check that it has a case where it stops.";
    case "AssertionError":
      return "A check in a test was false. Read the test to see what it expected.";
    default:
      return null;
  }
}
