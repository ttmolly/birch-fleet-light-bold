import { buildStateText } from "./text.ts";

export interface RowMark {
  text: string;
  mark: "unmarked" | "good" | "bad";
  map: string;
}

function line(p: {
  map: string;
  distance: number;
  altitude: number;
  battery: number;
  gps: boolean;
  obstacle: string;
  gap: number;
  target: "visible" | "hidden" | "none";
  overPad?: boolean;
}): string {
  return buildStateText({
    map: p.map,
    distance: p.distance,
    altitude: p.altitude,
    battery: p.battery,
    gps: p.gps,
    obstacle: p.obstacle,
    gap: p.gap,
    target: p.target,
    overPad: !!p.overPad,
  });
}

/** Synthetic rows across Corvid, Heron, and Falcon. Labels are applied later by the rules teacher. */
export function curriculumRows(): RowMark[] {
  const maps = ["corvid", "heron", "falcon"];
  const rows: RowMark[] = [];
  const push = (text: string, map: string) => rows.push({ text, mark: "unmarked", map });

  for (const map of maps) {
    for (const distance of [16, 22, 30, 46, 58, 74, 92]) {
      for (const altitude of [6, 12, 22]) {
        for (const battery of [55, 90]) {
          push(
            line({
              map,
              distance,
              altitude,
              battery,
              gps: true,
              obstacle: "none",
              gap: 28,
              target: battery > 70 ? "visible" : "hidden",
            }),
            map,
          );
        }
      }
    }
    for (const distance of [2.4, 3, 4, 5, 6, 7.5]) {
      for (const altitude of [3, 8, 14]) {
        for (const battery of [48, 88]) {
          push(
            line({
              map,
              distance,
              altitude,
              battery,
              gps: true,
              obstacle: "none",
              gap: 18,
              target: distance < 6 ? "visible" : "hidden",
            }),
            map,
          );
        }
      }
    }
    for (const distance of [0.4, 1, 1.6]) {
      for (const altitude of [1, 3, 6]) {
        push(
          line({
            map,
            distance,
            altitude,
            battery: 68,
            gps: true,
            obstacle: "none",
            gap: 16,
            target: "visible",
            overPad: true,
          }),
          map,
        );
      }
    }
    for (const battery of [4, 9, 15, 19]) {
      for (const distance of [12, 40, 70]) {
        push(
          line({
            map,
            distance,
            altitude: 11,
            battery,
            gps: true,
            obstacle: "none",
            gap: 20,
            target: "visible",
          }),
          map,
        );
      }
    }
    for (const distance of [8, 24, 55]) {
      push(
        line({
          map,
          distance,
          altitude: 9,
          battery: 77,
          gps: false,
          obstacle: "none",
          gap: 24,
          target: "none",
        }),
        map,
      );
      push(
        line({
          map,
          distance,
          altitude: 14,
          battery: 41,
          gps: false,
          obstacle: "rock",
          gap: 7,
          target: "hidden",
        }),
        map,
      );
    }
    for (const gap of [2, 3, 4, 6]) {
      push(
        line({
          map,
          distance: 26,
          altitude: 7,
          battery: 86,
          gps: true,
          obstacle: "trunk",
          gap,
          target: "visible",
        }),
        map,
      );
      push(
        line({
          map,
          distance: 18,
          altitude: 6,
          battery: 63,
          gps: true,
          obstacle: "trunk",
          gap,
          target: "hidden",
        }),
        map,
      );
    }
    for (const obstacle of ["roof", "ridge", "wire", "drone", "hazard"]) {
      push(
        line({
          map,
          distance: 34,
          altitude: 10,
          battery: 71,
          gps: true,
          obstacle,
          gap: 5,
          target: "hidden",
        }),
        map,
      );
    }
  }
  return rows;
}

export function trainingTexts(recorded: RowMark[]): string[] {
  const base = curriculumRows();
  const texts: string[] = [];
  for (const row of base) texts.push(row.text);
  for (const row of recorded) {
    texts.push(row.text);
    if (row.mark === "good") {
      texts.push(row.text);
      texts.push(row.text);
    }
  }
  return texts;
}
