import { ArrowDirection } from "@/components/atoms/model-arrow";

// TODO: move to env
export const SUPABASE_URL =
  "https://lmgbcuolwhkqoowxnaik.supabase.co/storage/v1/object/public/";

export type ProjectId = "jakarta" | "hong-kong" | "singapore" | "cambodia";

export type DirectionTuple = [ArrowDirection, number, string | null];

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
      1: [["forward", 1, null]],
      4: [
        ["left", 38, null],
        ["right", 1, null],
        ["reverse", -1, null],
      ],
      7: [
        ["right", 1, null],
        ["reverse", -1, null],
      ],
      8: [
        ["left", -1, null],
        ["forward", 1, null],
      ],
      10: [
        ["left", -1, null],
        ["forward", 1, null],
      ],
      12: [
        ["left", -1, null],
        ["reverse", 1, null],
      ],
      42: [
        ["reverse", -38, null],
        ["forward", 1, null],
      ],
      // 48: [["left",  -1], ["right", 1]],
      49: [
        ["right", -1, null],
        ["forward", 1, null],
      ],
      51: [
        ["right", 1, null],
        ["reverse", -1, null],
      ],
      59: [
        ["left", 1, null],
        ["reverse", -1, null],
      ],
      41: [["reverse", -1, null]],
      69: [["reverse", -1, null]],
    },
  },

  "hong-kong": {
    supabaseFolder: "streets_hkg_111024",
    supabasePrefixPath: "streets_hkg_111024",
    numberOfImages: 76,
    // image subtitle
    text: {},
    arrows: {
      1: [["forward", 1, null]],
      44: [["reverse", -1, null]],
      76: [["reverse", -39, null]],
    },
  },

    "singapore": {
    supabaseFolder: "streets_sg_161224",
    supabasePrefixPath: "streets_sg_161224",
    numberOfImages: 76,
    // image subtitle
    text: {},
    arrows: {
      1: [["up", 1, null]],
      2: [["up", 1, null]],
      3: [["forward", 1, null], ["down", -1, null]],
      7: [["forward", 4, null], ["reverse", -1, null]],
      11: [["forward", 1, null], ["reverse", -7, null]],
      13: [["right", -1, null], ["left", 1, null]],
      14: [["right", 6, "die"], ["left", -1, "back"], ["forward", 1, "run"]],
      15: [["right", 1, null], ["left", -1, null]],
      16: [["right", 1, null], ["left", -1, null]],
      17: [["right", 1, null], ["left", -1, null]],
      18: [["right", 1, null], ["left", -1, null]],
      19: [["right", -18, null], ["left", -1, null]],
      20: [["left", 1, null], ["right", -6, null]],
      21: [["reverse", 1, null], ["forward", -1, null]],
      22: [["reverse", 1, null], ["forward", -1, null]],
      23: [["right", -1, null]],

    },
  },

      "cambodia": {
    supabaseFolder: "streets_kh",
    supabasePrefixPath: "streets_kh",
    numberOfImages: 104,
    // image subtitle
    text: {},
    arrows: {
      1: [["reverse", 1, "Exit the hotel room"]],
            4: [["up", 4, "Go up the roof"], ["down", 1, "Go down the stairs"]],
                        5: [["reverse", 1, "Forward"], ["left", 93, "Back"]],
            6: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            7: [["reverse", 87, "Forward"], ["forward", -1, "Back"]],

            8: [["down", -4, "Go back down the hotel"], ["reverse", 1, "Forward"]],
            9: [["forward", -1, "Back"], ["reverse", 92, "Fall"]],
            10: [["up", 1, "Go up"], ["down", -6, "Go back to hotel stairs"]],
            11: [["reverse", 1, "Forward"], ["down", -1, "Go back down"]],
            12: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            13: [["reverse", 1, "Fall down"], ["forward", -1, "Back"]],
            14: [["reverse", 1, "Forward"], ["up", -1, "Go back up"]],
            15: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            16: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            17: [["down", 1, "Forward"], ["forward", -1, "Reverse"]],
            18: [["down", 1, "Fall down"], ["forward", -1, "Reverse"]],
            19: [["forward", 1, "Continue"], ["up", -1, "Go back up"]],
            20: [["reverse", -1, "Back"], ["left", 1, "Continue to explore"]],
            21: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            22: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            23: [["reverse", 1, "Forward"], ["left", -1, "Back"]],
            24: [["reverse", 1, "Forward"], ["left", -1, "Back"]],
            25: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            26: [["reverse", 1, "Forward"], ["forward", -1, "Reverse"]],
            27: [["down", 1, "Go down"], ["forward", -1, "Back"]],
            28: [["forward", 1, "Keep going"], ["up", -1, "Go back up"]],
            29: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            30: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            31: [["reverse", 1, "Forward"], ["left", -1, "Back to water tower"]],
            32: [["left", 1, "Forward to Kings Palace"], ["right", -1, "Back to water tower"]],
            33: [["reverse", 1, "Forward to Kings Palace"], ["forward", -1, "Back"]],
            34: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            35: [["right", 1, "Forward"], ["left", -1, "Back"]],
            36: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            37: [["reverse", 1, "Go out"], ["forward", -1, "Back"]],
            38: [["reverse", 1, "Forward"], ["forward", -1, "Back to Palace"]],
            39: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            40: [["right", 1, "Another exit"], ["forward", -1, "Back"]],
            41: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            42: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            43: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            44: [["reverse", 1, "Go to the chamber"], ["forward", 48, "Back"]],
            45: [["reverse", 1, "Go to the kitchen"], ["forward", -1, "Back"]],
            46: [["right", 1, "Jump out the window"], ["left", -1, "Back"]],
            47: [["reverse", 1, "Go to the mushroom"], ["left", -1, "Back to the house"], ["forward", 18, "Towards hotel"], ["right", -16, "To water tank"]],
            48: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            49: [["up", 1, "Go up the mushroom"], ["forward", -1, "Back"]],
            50: [["reverse", 1, "Go out of the monument"], ["forward", -1, "Back"]],
            51: [["left", 5, "To the road"], ["reverse", -1, "Back"]],
            52: [["reverse", 1, "Forward"], ["forward", -1, "Back to the road"]],
            53: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            54: [["forward", -1, "Back"], ["reverse", 1, "Go to the road"], ["left", 17, "Go to the house"]],
            55: [["reverse", 1, "Forward"], ["forward", 2, "Back"], ["left", 1, "To the road"]],
            56: [["left", 32, "Go to temple"], ["reverse", 1, "Go to railway station"], ["right", 35, "Go to Truman Show"]],
            57: [["left", -2, "Forward"], ["right", -1, "Back"], ["down", 22, "Jump down the water"]],
            // boat is at 79
            58: [["reverse", 1, "Forward"], ["forward", 21, "Back to boat"]],
            59: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            60: [["right", 1, "Check out the stones"], ["forward", -1, "Back"]],
            61: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            62: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            63: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            64: [["reverse", 1, "Get out"], ["right", -1, "Back"]],
            65: [["reverse", -18, "Back to mushroom"], ["forward", 1, "Go towards gate"], ["left", -9, "Back to railway station"], ["right", -1, "To church"]],
            66: [["right", -1, "Back"], ["left", 1, "Enter gate"]],
            67: [["reverse", -1, "Back to gate"], ["forward", 1, "Go towards hotel"]],
            68: [["forward", -1, "Back"], ["reverse", 1, "Forward"]],
            69: [["forward", -1, "Back"], ["reverse", 1, "Forward"]],
            70: [["forward", -1, "Back"], ["reverse", 1, "Forward"]],

            71: [["forward", 1, "Forward"], ["reverse", -1, "Back"]],
            72: [["forward", 1, "Forward"], ["reverse", -1, "Back"]],
            73: [["up", 1, "Party"], ["right", -1, "Back"], ["reverse", 25, "Door out"]],
            74: [["right", 1, "Forward"], ["down", -1, "Back to the darkroom"], ["reverse", 3, "Fall"]],
            75: [["down", -2, "Back to the darkroom"], ["forward", -1, "Back"]],
            76: [["reverse", -75, "Enter door"]],

            77: [["left", -63, "Forward"], ["up", -1, "Back to the drunk"]],
            
            79: [["up", -22, "Back up"], ["right", -21, "Another island"], ["left", 1, "Island"]],

            80: [["reverse", 1, "Forward"], ["forward", -1, "Back"], ["right", 1, "Go to luxury"]],

            81: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            82: [["down", 1, "Go down"], ["left", -1, "Back"]],
            83: [["down", -73, "Keep going down"], ["left", -1, "Back"]],
            84: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            85: [["forward", 1, "Forward"], ["right", -1, "Back"]],
            86: [["reverse", 8, "More luxury?"], ["left", -2, "Back"], ["down", 1, "Down the pool"]],
            87: [["up", -1, "Go back up"], ["down", 1, "Go deeper"], ["right", 13, "Back"]],
            88: [["up", -1, "Go back up"],  ["reverse", 1, "Temple"], ["left", -32, "Back to railway station"]],
            89: [["forward", -1, "Back"], ["reverse", 1, "Forward"],
],          90: [["up", -1, "Back"], ["reverse", 11, "Fall again"]],


            91: [["reverse", -5, "Experience the Chinese developer luxury"], ["forward", -35, "Back to the road"]],
            92: [["reverse", -48, "Forward"], ["forward", -1, "Back"], ["left", -36, "To the road"]],

            93: [["right", 6, "Back"], ["reverse", -17, "Exit door"]],

            94: [["reverse", -4, "Jump to cliff"], ["forward", 1, "Back"]],
            95: [["reverse", -26, "Go towards the hotel"], ["forward", -1, "Go to the balcony"]],
            96: [["reverse", 1, "Forward"]],
            97: [["reverse", -87, "Forward"], ["forward", -1, "Back"]],
            98: [["reverse", -93, "Forward"], ["left", 1, "Towards other room"], ["right", 6, "Go out"]],
            99: [["reverse", -2, "Other room"], ["forward", -1, "Back"]],

            100: [["reverse", -2, "Go in the house"], ["left", -13, "To lake"]],
            101: [["reverse", 1, "Forward"], ["forward", -1, "Back"], ["down", -84, "Down to another circle"]],
            102: [["reverse", 1, "Forward"], ["forward", -1, "Back"]],
            103: [["reverse", 0, "The END"], ["forward", -1, "Back"]],
            104: [["left", -20, "Gentrification"], ["reverse", -6, "Back in"]],

    },
  },

};
