import { describe, expect, it } from "vitest";
import {
  addDays,
  dayLabel,
  mondayOf,
  nextWeekStart,
  parseWeekParam,
  todayInParis,
  weekLabel,
  weekRelation,
} from "@/lib/week";

describe("todayInParis", () => {
  it("prend la date à l'heure de Paris", () => {
    expect(todayInParis(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
    expect(todayInParis(new Date("2026-11-22T12:00:00Z"))).toBe("2026-11-22");
  });
});

describe("mondayOf / addDays", () => {
  it("retrouve le lundi d'une date", () => {
    expect(mondayOf("2026-11-25")).toBe("2026-11-23");
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
  });

  it("ajoute des jours en passant les mois et les années", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(addDays("2026-11-23", -7)).toBe("2026-11-16");
  });
});

describe("nextWeekStart", () => {
  it("donne le lundi qui suit", () => {
    expect(nextWeekStart("2026-11-17")).toBe("2026-11-23");
    expect(nextWeekStart("2026-11-22")).toBe("2026-11-23");
  });

  it("un lundi, donne le lundi d'après", () => {
    expect(nextWeekStart("2026-11-23")).toBe("2026-11-30");
  });
});

describe("parseWeekParam", () => {
  it("ramène une date au lundi de sa semaine", () => {
    expect(parseWeekParam("2026-11-25", "2026-11-17")).toBe("2026-11-23");
  });

  it("retombe sur la semaine prochaine sans date valable", () => {
    expect(parseWeekParam(undefined, "2026-11-17")).toBe("2026-11-23");
    expect(parseWeekParam("bidule", "2026-11-17")).toBe("2026-11-23");
    expect(parseWeekParam("2026-02-31", "2026-11-17")).toBe("2026-11-23");
  });
});

describe("weekLabel", () => {
  it("dans le même mois", () => {
    expect(weekLabel("2026-11-23")).toBe("Semaine du 23 au 29 novembre");
  });

  it("à cheval sur deux mois", () => {
    expect(weekLabel("2026-11-30")).toBe("Semaine du 30 novembre au 6 décembre");
  });

  it("à cheval sur deux années", () => {
    expect(weekLabel("2026-12-28")).toBe("Semaine du 28 décembre 2026 au 3 janvier 2027");
  });

  it("écrit « 1er »", () => {
    expect(weekLabel("2026-06-01")).toBe("Semaine du 1er au 7 juin");
  });
});

describe("dayLabel", () => {
  it("donne le jour et sa date", () => {
    expect(dayLabel("2026-11-23", 0)).toEqual({ short: "Lun", long: "lundi", date: "23" });
    expect(dayLabel("2026-11-30", 6)).toEqual({ short: "Dim", long: "dimanche", date: "6" });
  });
});

describe("weekRelation", () => {
  it("reconnaît cette semaine et la prochaine", () => {
    expect(weekRelation("2026-11-16", "2026-11-17")).toBe("current");
    expect(weekRelation("2026-11-23", "2026-11-17")).toBe("next");
    expect(weekRelation("2026-11-30", "2026-11-17")).toBeNull();
  });
});
