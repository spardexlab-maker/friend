import { Capacitor, registerPlugin } from "@capacitor/core";
import { useApp } from "./app-state";
import { basisLabels } from "./pages";
export async function printCourse() {
  if (Capacitor.isNativePlatform()) {
    await registerPlugin<{ printCourse: () => Promise<void> }>(
      "WearBridge",
    ).printCourse();
  } else window.print();
}
export function PrintDocument() {
  const { s } = useApp();
  return (
    <section className="print-document" dir="rtl">
      <h1>رفيق — كورس {s.profile.name}</h1>
      <p>
        خطة مرنة حسب الظروف •{" "}
        {new Date().toLocaleDateString("ar-IQ", { timeZone: "Asia/Baghdad" })}
      </p>
      <p>
        الأوزان التالية أوزان الخطة. سجلات أدائك محفوظة بشكل منفصل. أي نطاق وزن
        بالملف الأصلي يبدأ هنا بالقيمة المدخلة، ويمكنك تعديلها.
      </p>
      {s.plans.map((p) => (
        <article key={p.name}>
          <h2>{p.name}</h2>
          <table>
            <thead>
              <tr>
                <th>التمرين</th>
                <th>الجولات × التكرار</th>
                <th>الوزن وأساسه</th>
                <th>الراحة</th>
              </tr>
            </thead>
            <tbody>
              {p.exercises.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.name}
                    <br />
                    <small>{e.english}</small>
                  </td>
                  <td>
                    {e.sets} × {e.reps}
                  </td>
                  <td>
                    {e.weight} {e.unit} • {basisLabels[e.basis]}
                  </td>
                  <td>{e.rest} ثانية</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
      <p>
        رتّب الجلسات حسب ظروفك. الأوزان الفعلية تُدخلها لكل جولة، وتغيير الخطة
        لا يغيّر السجلات القديمة.
      </p>
    </section>
  );
}
