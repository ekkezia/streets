import { ArrowDirection } from "@/components/atoms/model-arrow";

// TODO: move to env
export const SUPABASE_URL =
  "https://lmgbcuolwhkqoowxnaik.supabase.co/storage/v1/object/public/";

export type ProjectId = "jkt";

export type DirectionTuple = [ArrowDirection, number];

export type Config = {
  [key: string]: {
    supabaseFolder: string;
    supabasePrefixPath: string;
    numberOfImages: number;
    arrows: {
      [key: number]: DirectionTuple[];
    };
  };
};

export const CONFIG: Config = {
  jkt: {
    supabaseFolder: "streets_jkt_290824",
    supabasePrefixPath: "streets_jkt_290824",
    numberOfImages: 69,
    arrows: {
      1: [["down", 1]],
      4: [
        ["left", 38],
        ["right", 1],
        ["up", -1],
      ],
      7: [
        ["right", 1],
        ["up", -1],
      ],
      8: [
        ["left", -1],
        ["down", 1],
      ],
      10: [
        ["left", -1],
        ["down", 1],
      ],
      12: [
        ["left", -1],
        ["up", 1],
      ],
      42: [["up", -38], ["down", 1]],
      // 48: [["left",  -1], ["right", 1]],
      49: [["right",  -1], ["down", 1]],
      51: [["right",  1], ["up", -1]],
      59: [["left",  1], ["up", -1]],
      41: [["up", -1]],
      69: [["up", -1]],
    },
  },
};
