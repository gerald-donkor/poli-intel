import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BUTTON_SOURCE = readFileSync(
  join(process.cwd(), "components/ui/button.tsx"),
  "utf8"
);

const CHECKBOX_SOURCE = readFileSync(
  join(process.cwd(), "components/ui/checkbox.tsx"),
  "utf8"
);

const SWITCH_SOURCE = readFileSync(
  join(process.cwd(), "components/ui/switch.tsx"),
  "utf8"
);

const RADIO_GROUP_SOURCE = readFileSync(
  join(process.cwd(), "components/ui/radio-group.tsx"),
  "utf8"
);

const GLOBALS_CSS_SOURCE = readFileSync(
  join(process.cwd(), "app/globals.css"),
  "utf8"
);

const AGENTS_MD_SOURCE = readFileSync(
  join(process.cwd(), "AGENTS.md"),
  "utf8"
);

test.describe("Hover Pointer and Cursor Contracts", () => {
  test("should define cursor-pointer in buttonVariants", () => {
    expect(BUTTON_SOURCE).toContain("cursor-pointer");
  });

  test("should define cursor-pointer in Checkbox", () => {
    expect(CHECKBOX_SOURCE).toContain("cursor-pointer");
  });

  test("should define cursor-pointer in Switch", () => {
    expect(SWITCH_SOURCE).toContain("cursor-pointer");
  });

  test("should define cursor-pointer in RadioGroupItem", () => {
    expect(RADIO_GROUP_SOURCE).toContain("cursor-pointer");
  });

  test("should declare cursor: pointer globally inside app/globals.css for interactive tags", () => {
    expect(GLOBALS_CSS_SOURCE).toContain("cursor: pointer;");
  });

  test("should declare cursor-not-allowed globally inside app/globals.css for disabled elements", () => {
    expect(GLOBALS_CSS_SOURCE).toContain("cursor: not-allowed !important;");
  });

  test("should include cursor rule (rule 16) in AGENTS.md under Section 11", () => {
    expect(AGENTS_MD_SOURCE).toContain(
      "All interactive UI elements"
    );
    expect(AGENTS_MD_SOURCE).toContain(
      "cursor-pointer"
    );
    expect(AGENTS_MD_SOURCE).toContain(
      "cursor-not-allowed"
    );
  });
});
