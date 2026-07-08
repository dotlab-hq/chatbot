import { tool } from "ai";
import { z } from "zod";

const CONVERSIONS: Record<string, Record<string, number>> = {
  // Length (base: meter)
  meter: {
    meter: 1,
    kilometer: 0.001,
    centimeter: 100,
    millimeter: 1000,
    mile: 0.000_621_371,
    yard: 1.093_61,
    foot: 3.280_84,
    inch: 39.3701,
  },
  kilometer: {
    meter: 1000,
    kilometer: 1,
    centimeter: 100_000,
    millimeter: 1_000_000,
    mile: 0.621_371,
    yard: 1093.61,
    foot: 3280.84,
    inch: 39_370.1,
  },
  mile: {
    meter: 1609.34,
    kilometer: 1.609_34,
    mile: 1,
    yard: 1760,
    foot: 5280,
    inch: 63_360,
  },
  foot: {
    meter: 0.3048,
    kilometer: 0.000_304_8,
    mile: 0.000_189_394,
    yard: 0.333_333,
    foot: 1,
    inch: 12,
  },
  inch: {
    meter: 0.0254,
    kilometer: 0.000_025_4,
    mile: 0.000_015_782_8,
    yard: 0.027_777_8,
    foot: 0.083_333_3,
    inch: 1,
  },
  yard: {
    meter: 0.9144,
    kilometer: 0.000_914_4,
    mile: 0.000_568_182,
    yard: 1,
    foot: 3,
    inch: 36,
  },
  // Weight (base: kilogram)
  kilogram: {
    kilogram: 1,
    gram: 1000,
    milligram: 1_000_000,
    pound: 2.204_62,
    ounce: 35.274,
    tonne: 0.001,
  },
  gram: {
    kilogram: 0.001,
    gram: 1,
    milligram: 1000,
    pound: 0.002_204_62,
    ounce: 0.035_274,
    tonne: 0.000_001,
  },
  pound: {
    kilogram: 0.453_592,
    gram: 453.592,
    milligram: 453_592,
    pound: 1,
    ounce: 16,
    tonne: 0.000_453_592,
  },
  ounce: {
    kilogram: 0.028_349_5,
    gram: 28.3495,
    milligram: 28_349.5,
    pound: 0.0625,
    ounce: 1,
    tonne: 0.000_028_349_5,
  },
  // Temperature handled separately
};

const TEMP_UNITS = ["celsius", "fahrenheit", "kelvin"] as const;

function convertTemp(value: number, from: string, to: string): number {
  // Convert to Celsius first
  let celsius: number;
  if (from === "celsius") {
    celsius = value;
  } else if (from === "fahrenheit") {
    celsius = (value - 32) * (5 / 9);
  } else {
    celsius = value - 273.15; // kelvin
  }

  // Convert from Celsius
  if (to === "celsius") {
    return celsius;
  }
  if (to === "fahrenheit") {
    return celsius * (9 / 5) + 32;
  }
  return celsius + 273.15; // kelvin
}

function findUnit(input: string): string | null {
  const lower = input.toLowerCase();
  // Check exact match first
  if (CONVERSIONS[lower] || TEMP_UNITS.includes(lower as any)) {
    return lower;
  }
  // Check singular/plural
  if (lower.endsWith("s")) {
    const singular = lower.slice(0, -1);
    if (CONVERSIONS[singular] || TEMP_UNITS.includes(singular as any)) {
      return singular;
    }
  }
  return null;
}

export const unitConverter = tool({
  description:
    "Convert between units of measurement. Supports length (meter, kilometer, mile, foot, inch, yard), weight (kilogram, gram, pound, ounce), and temperature (celsius, fahrenheit, kelvin).",
  inputSchema: z.object({
    value: z.number().describe("Numeric value to convert"),
    from: z.string().describe("Source unit (e.g., 'feet', 'celsius', 'kg')"),
    to: z.string().describe("Target unit (e.g., 'meters', 'fahrenheit', 'lb')"),
  }),
  execute: (input) => {
    const from = findUnit(input.from);
    const to = findUnit(input.to);

    if (!from) {
      return { error: `Unknown source unit: "${input.from}".` };
    }
    if (!to) {
      return { error: `Unknown target unit: "${input.to}".` };
    }

    const isTemp =
      TEMP_UNITS.includes(from as any) && TEMP_UNITS.includes(to as any);
    if (
      !isTemp &&
      TEMP_UNITS.includes(from as any) !== TEMP_UNITS.includes(to as any)
    ) {
      return {
        error: `Cannot convert between temperature and ${TEMP_UNITS.includes(from as any) ? "non-temperature" : "temperature"} units.`,
      };
    }

    let result: number;
    if (isTemp) {
      result = convertTemp(input.value, from, to);
    } else {
      const fromTable = CONVERSIONS[from];
      if (!fromTable?.[to]) {
        return { error: `Cannot convert from "${from}" to "${to}".` };
      }
      result = input.value * fromTable[to];
    }

    return { value: input.value, from, to, result };
  },
});
