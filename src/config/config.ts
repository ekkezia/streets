import { ArrowDirection } from "@/components/atoms/model-arrow";

// TODO: move to env
export const SUPABASE_URL =
  "https://lmgbcuolwhkqoowxnaik.supabase.co/storage/v1/object/public/";

export type ProjectId = "jakarta" | "hong-kong";

export type DirectionTuple = [ArrowDirection, number];

export type Config = {
  [key: string]: {
    supabaseFolder: string;
    supabasePrefixPath: string;
    numberOfImages: number;
    text: {
      [key: number]: string;
    };
    arrows: {
      [key: number]: DirectionTuple[];
    };
  };
};

export const CONFIG: Config = {
  jakarta: {
    supabaseFolder: "streets_jkt_290824",
    supabasePrefixPath: "streets_jkt_290824",
    numberOfImages: 69,
    // image subtitle
    text: {
      1: "[INARAH] Gimana ya cara keliling Jakarta Pusat?",
      4: "[INARAH] Belok kanan, atau kiri?",
      5: "[INARAH] Kalo ke kanan sih arah ke Pasar Baru.",
      6: "[INARAH] Duh.. panas banget!",
      7: "[INARAH] Eh yaelah, kenapa gak naik busway aja ya?",
      8: "[INARAH] Perlu seberang kalo mau ke Pasar Baru.",
      9: "[INARAH] Permisi..",
      13: "[INARAH] Akhirnya sampe di Pasar Baru.",
      14: "[INARAH] Belanja ukulele ah..",
      16: "[INARAH] Dapet angklung juga hehe..",
      20: "[INARAH] Ups keseleo..",
      22: "[INARAH] Asyik dapet sepatu baru Bata!",
      23: "[INARAH] Langsung ganti ya sepatunya..",
      24: "[ANAK-ANAK] Itu lagi foto apa tu kakaknya?",
      25: "[SUARA TAPAK KAKI COPET]",
      26: "[SUARA TAPAK KAKI COPET MENDEKAT]",
      27: "[SUARA TAPAK KAKI COPET SEMAKIN KERAS]",
      28: "[INARAH] Eh.. [SUARA COPET MENARIK TAS KERTAS]",
      29: "[INARAH] COPET!!! ADA COPET!!!",
      30: "[INARAH] EH COPET JANGAN KABUR!!",
      31: "[INARAH] Woy.. larinya cepet amat COPET!",
      32: "[INARAH] Aduh.. barang gue yang baru dibeli..",
      33: "[INARAH TERENGAH-ENGAH]",
      34: "[SUARA TANGISAN INARAH]",
      35: "[INARAH] Loh? Elena? [ELENA] Loh? Inarah?",
      36: "[ELENA] Beb ada apa? [INARAH] Aku baru kecopetan..",
      37: "[ELENA] Udah gapapa..",
      38: "[FOTOGRAFER] 1, 2, 3, Cheese..",
      39: "[ELENA & INARAH] Ih mau tasnya..",
      41: "[ELENA & INARAH] Dadaah Pasar Baru!",

      42: "[INARAH] Kalo ke kiri sih arah ke Lapangan Banteng.",
      43: "[SUARA KAKEK MENDENGKUR]",
      44: "[TUKANG BAKSO] Makasih mbak, ini baksonya!",
      47: "[SUARA KONSTRUKSI JALAN]",
      48: "[INARAH] Capek ah, duduk dulu.",
      49: "[INARAH] Perlu seberang kalo mau ke Lapangan Banteng.",
      50: "[INARAH] Permisi...",
      53: "[SUARA PIRING & MANGKOK]",
      56: "[INARAH] Lapangan Banteng di kanan!",
      58: "[INARAH] Dikit lagi nyampe.",
      60: "[INARAH] Akhirnya sampe di Lapangan Banteng.",
      61: "[INARAH] Eh? Siapa tu?",
      62: "[INARAH] ELENA! [ELENA] INARAH!",
      63: "[SUARA TAPAK KAKI ELENA & INARAH]",
      64: "[SUARA TAPAK KAKI ELENA & INARAH]",
      65: "[ELENA] Apa kabar beb?",
      66: "[INARAH] Pelukan dulu!",
      67: "[ELENA] Kang foto, boleh tolong fotoin?",
      68: "[FOTOGRAFER] 1, 2, 3, Cheese...",
      69: "[ELENA & INARAH] Dadaah Lapangan Banteng!",
    },
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
      42: [
        ["up", -38],
        ["down", 1],
      ],
      // 48: [["left",  -1], ["right", 1]],
      49: [
        ["right", -1],
        ["down", 1],
      ],
      51: [
        ["right", 1],
        ["up", -1],
      ],
      59: [
        ["left", 1],
        ["up", -1],
      ],
      41: [["up", -1]],
      69: [["up", -1]],
    },
  },

  "hong-kong": {
    supabaseFolder: "streets_hkg_111024",
    supabasePrefixPath: "streets_hkg_111024",
    numberOfImages: 76,
    // image subtitle
    text: {},
    arrows: {
      1: [["down", 1]],
      44: [["up", -1]],
      76: [["up", -39]],
    },
  },
};
