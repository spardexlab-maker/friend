// Per 100 g, normalized from the user's food PDF; estimates, not brand-specific lab measurements.
export const foods = [
  {
    name: "صدر دجاج مطبوخ",
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    prep: "مطبوخ بدون زيت إضافي",
  },
  {
    name: "تمن مطبوخ",
    kcal: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    prep: "مطبوخ بدون زيت إضافي",
  },
  {
    name: "شوفان ناشف",
    kcal: 380,
    protein: 13.1,
    carbs: 65.7,
    fat: 7,
    prep: "وزن ناشف",
  },
  {
    name: "بطاطا مسلوقة",
    kcal: 86.7,
    protein: 2,
    carbs: 20,
    fat: 0.1,
    prep: "مسلوقة",
  },
  {
    name: "زيت زيتون",
    kcal: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
    prep: "كمية الزيت الفعلية",
  },
  {
    name: "لحم بقر قليل الدهن مطبوخ",
    kcal: 172.7,
    protein: 27.3,
    carbs: 0,
    fat: 6.4,
    prep: "مطبوخ 5% دهن؛ تقديري",
  },
  {
    name: "لبن يوناني خالي الدسم",
    kcal: 58.3,
    protein: 10.3,
    carbs: 3.6,
    fat: 0.3,
    prep: "القيم تختلف حسب الماركة",
  },
  {
    name: "تونة بالماء مصفاة",
    kcal: 116.7,
    protein: 25.8,
    carbs: 0,
    fat: 0.8,
    prep: "مصفاة",
  },
];
export type Food = (typeof foods)[number];
export function portion(food: Food, grams: number) {
  return {
    kcal: (food.kcal * grams) / 100,
    protein: (food.protein * grams) / 100,
    carbs: (food.carbs * grams) / 100,
    fat: (food.fat * grams) / 100,
  };
}
