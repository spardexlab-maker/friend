import { useState } from "react";
import { CalendarClock, ChevronLeft, Pause, SkipForward } from "lucide-react";
import { useApp } from "./app-state";
import { stamp, id } from "./domain";
import { shiftDay } from "./insights";
export function TrainingDay() {
  const { s, date, change, confirm, notify } = useApp(),
    [expanded, setExpanded] = useState(false),
    [reason, setReason] = useState(""),
    [nextDate, setNextDate] = useState(shiftDay(date, 1));
  const decision = s.trainingDecisions.filter((x) => x.date === date).at(-1),
    upcoming = s.trainingDecisions
      .filter(
        (x) =>
          x.status === "postponed" &&
          x.nextDate === date &&
          x.sessionId === s.sessionId,
      )
      .at(-1);
  async function decide(status: "rest" | "postponed" | "skipped") {
    const success = await change("تعديل قرار تمرين اليوم", (d) => ({
      ...d,
      restDates: d.restDates.includes(date)
        ? d.restDates
        : [...d.restDates, date],
      trainingDecisions: [
        ...d.trainingDecisions.filter((x) => x.date !== date),
        {
          ...stamp(date),
          status,
          sessionId: d.sessionId,
          name: d.plans[d.session].name,
          reason: reason.trim(),
          ...(status === "postponed" ? { nextDate } : {}),
        },
      ],
      ...(status === "skipped"
        ? { session: (d.session + 1) % 5, sessionId: id() }
        : {}),
    }));
    if (success) {
      setExpanded(false);
      notify(
        status === "skipped"
          ? "تخطّينا الجلسة وجهزنا التالية، بدون اعتبارها تمريناً مكتملاً"
          : "انحفظ القرار؛ جلسة التمرين تبقى محفوظة",
      );
    }
  }
  return (
    <section className="training-day">
      <div className="training-day-heading">
        <span className="familiar-icon">
          <CalendarClock size={21} />
        </span>
        <div>
          <b>
            {decision
              ? decision.status === "rest"
                ? `يوم راحة · ${decision.name} تبقى للجلسة القادمة`
                : decision.status === "postponed"
                  ? `${decision.name} مؤجلة إلى ${decision.nextDate}`
                  : `تخطّيت ${decision.name} اليوم`
              : upcoming
                ? `${upcoming.name} مؤجلة لهذا اليوم`
                : `جلسة ${s.plans[s.session].name} هي التالية، مو شرط تتمرن اليوم`}
          </b>
          <p>
            {decision?.reason ||
              "قرارك يتغيّر حسب ظروفك. ما نعتبر الخطة تمريناً نفّذته."}
          </p>
        </div>
        <button className="text-button" onClick={() => setExpanded(!expanded)}>
          ما تمرنت اليوم؟
          <ChevronLeft size={16} />
        </button>
      </div>
      {expanded && (
        <div className="training-day-options">
          <label>
            السبب أو الملاحظة (اختياري)
            <input
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="تعب، ظرف، مشغول…"
            />
          </label>
          <div className="decision-buttons">
            <button onClick={() => decide("rest")}>
              <Pause size={18} />
              <b>راحة اليوم</b>
              <small>نفس الجلسة تبقى التالية</small>
            </button>
            <button
              onClick={() =>
                confirm(
                  "نتخطّى الجلسة وننتقل للتالية؟ تبقى الجولات المسجلة محفوظة، وما نعتبرها جلسة مكتملة.",
                  () => decide("skipped"),
                )
              }
            >
              <SkipForward size={18} />
              <b>تخطّي الجلسة</b>
              <small>ننتقل للي بعدها بالكورس</small>
            </button>
          </div>
          <div className="postpone">
            <label>
              أجّل الجلسة إلى
              <input
                aria-label="موعد الجلسة المؤجلة"
                type="date"
                min={shiftDay(date, 1)}
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              disabled={!nextDate || nextDate <= date}
              onClick={() => decide("postponed")}
            >
              تأجيل الجلسة
            </button>
          </div>
          <p className="caption">
            اختيار الراحة أو التأجيل يفعّل هدف سعرات الراحة لهذا اليوم، وتكدر
            تبدّله من التغذية.
          </p>
        </div>
      )}
      {decision && (
        <button
          className="text-button"
          onClick={() =>
            confirm(
              "نلغي قرار اليوم ونرجع هدف يوم التمرين؟ إلغاء التخطي ما يرجع ترتيب الكورس تلقائياً؛ تقدر تختار الجلسة من تمريني.",
              async () => {
                await change("إلغاء قرار تمرين اليوم", (d) => ({
                  ...d,
                  trainingDecisions: d.trainingDecisions.filter(
                    (x) => x.date !== date,
                  ),
                  restDates: d.restDates.filter((x) => x !== date),
                }));
              },
            )
          }
        >
          إلغاء قرار اليوم
        </button>
      )}
    </section>
  );
}
