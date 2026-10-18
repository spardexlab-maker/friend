import { Watch, Plus, Trash2, MessageCircle } from "lucide-react";
import { useApp } from "./app-state";
import { Card } from "./components";
export function WatchFoodInbox() {
  const { s, open, change, confirm, setTab, setDate } = useApp(),
    items = [...s.pendingFoods].sort((a, b) => b.time.localeCompare(a.time));
  if (!items.length) return null;
  return (
    <Card
      title={
        <>
          <Watch size={18} />
          وجبات من الساعة تحتاج مراجعة
        </>
      }
    >
      <p className="caption">
        هذه أوصاف محفوظة، بعد ما دخلت بمجموع سعراتك. أكمل القيم أو اطلب تقديراً
        وراجعه.
      </p>
      {items.map((x) => (
        <div className="watch-food-item" key={x.id}>
          <div>
            <b>{x.name}</b>
            <p>
              {x.grams == null ? "الكمية تحتاج تحديد" : `${x.grams} غ`} ·{" "}
              {x.preparation || "التحضير غير محدد"} · {x.date}
            </p>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() =>
                open("meal", {
                  name: x.name,
                  grams: x.grams ?? 0,
                  preparation: x.preparation,
                  original: x.original,
                  date: x.date,
                  source: "Galaxy Watch — مراجعة على الهاتف",
                  pendingFoodId: x.id,
                })
              }
            >
              <Plus size={15} />
              أكمل وسجّل
            </button>
            <button
              className="text-button"
              onClick={() => {
                sessionStorage.setItem(
                  "rafiq-food-draft",
                  JSON.stringify({
                    id: x.id,
                    text: `أريد تقدير القيم الغذائية لهذه الوجبة التي وصفتها من الساعة: ${x.original || x.name}. الكمية: ${x.grams == null ? "غير محددة" : x.grams + " غ"}. التحضير: ${x.preparation || "غير محدد"}. اسألني عن أي تفاصيل ناقصة، وبعدها اعرض اقتراح تسجيل للمراجعة.`,
                  }),
                );
                setDate(x.date);
                setTab("chat");
              }}
            >
              <MessageCircle size={15} />
              قدّر مع رفيق
            </button>
            <button
              className="icon-button"
              aria-label={`حذف وصف وجبة ${x.name}`}
              onClick={() =>
                confirm("حذف الوصف المعلّق؟", () =>
                  change("حذف وصف وجبة الساعة", (d) => ({
                    ...d,
                    pendingFoods: d.pendingFoods.filter((p) => p.id !== x.id),
                  })),
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}
